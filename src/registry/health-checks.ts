/**
 * The health checks behind the registry's read-only health report (issue
 * #2): broken targets, redirect cycles/chains, reciprocal `redirects_from`
 * mismatches, duplicate claims, and promotion candidates. Pure functions
 * over a built `RegistryState` — no vault access, no mutation.
 */

import {
	HealthIssue,
	brokenTargetIssue,
	chainIssue,
	cycleIssue,
	duplicateClaimIssue,
	duplicateSwallowClaimIssue,
	invalidSwallowClaimantIssue,
	missingReciprocalIssue,
	promotionCandidateIssue,
	staleReciprocalIssue,
	staleSwallowClaimIssue,
} from './health';
import { VaultIndex } from './resolver';
import { RedirectEntry, RegistryState, pathClaimKey } from './state';

export function computeHealthIssues(state: RegistryState, index: VaultIndex): HealthIssue[] {
	const issues: HealthIssue[] = [];

	for (const [path, entry] of state.redirects) {
		issues.push(...checkBrokenTarget(path, 'redirect_to', entry));
	}

	for (const [, entry] of state.disambiguations) {
		for (const candidate of entry.candidates) {
			issues.push(
				...checkBrokenTarget(entry.file.path, 'disambiguates', {
					file: entry.file,
					resolved: candidate,
				}),
			);
		}
	}

	issues.push(...checkCyclesAndChains(state));
	issues.push(...checkReciprocals(state));
	issues.push(...checkDuplicateClaims(state));
	issues.push(...checkPromotionCandidates(state));
	issues.push(...checkSwallowClaims(state, index));

	return issues;
}

function checkSwallowClaims(state: RegistryState, index: VaultIndex): HealthIssue[] {
	const issues: HealthIssue[] = [];

	for (const claim of state.invalidSwallowClaims) {
		issues.push(invalidSwallowClaimantIssue(claim.claimant.path, claim.term));
	}

	for (const [term, claims] of state.swallowClaims) {
		const distinctClaimants = [...new Set(claims.map((c) => c.claimant.path))];
		if (distinctClaimants.length > 1) {
			issues.push(duplicateSwallowClaimIssue(term, distinctClaimants));
		}

		const claimantPaths = new Set(distinctClaimants);
		const collidingRealFile = index
			.findByBasename(term)
			.find((file) => !claimantPaths.has(file.path));
		if (collidingRealFile) {
			for (const claim of claims) {
				issues.push(staleSwallowClaimIssue(claim.claimant.path, term, collidingRealFile.path));
			}
		}
	}

	return issues;
}

function checkBrokenTarget(
	path: string,
	property: string,
	entry: RedirectEntry,
): HealthIssue[] {
	const { resolved } = entry;
	switch (resolved.status) {
		case 'unresolved-note':
			return [brokenTargetIssue(path, property, resolved.target, 'does not resolve to any note')];
		case 'ambiguous-note':
			return [
				brokenTargetIssue(
					path,
					property,
					resolved.target,
					`matches ${resolved.candidates?.length ?? 0} notes; qualify with a full path`,
				),
			];
		case 'unresolved-heading':
			return [brokenTargetIssue(path, property, resolved.target, 'heading not found in target note')];
		case 'unresolved-block':
			return [brokenTargetIssue(path, property, resolved.target, 'block id not found in target note')];
		case 'resolved':
			return [];
	}
}

function checkCyclesAndChains(state: RegistryState): HealthIssue[] {
	const { redirects } = state;
	const issues: HealthIssue[] = [];
	const reportedCycle = new Set<string>();

	// A path that another redirect already resolves to is a hop inside
	// someone else's chain, not the start of its own — walking from it too
	// would re-report the same chain as a shorter duplicate.
	const targetedPaths = new Set<string>();
	for (const entry of redirects.values()) {
		if (entry.resolved.status === 'resolved' && entry.resolved.file) {
			targetedPaths.add(entry.resolved.file.path);
		}
	}

	for (const startPath of redirects.keys()) {
		const chain: string[] = [startPath];
		const seen = new Set<string>([startPath]);
		let current = startPath;
		let cyclePath: string[] | undefined;

		for (;;) {
			const entry = redirects.get(current);
			if (!entry || entry.resolved.status !== 'resolved' || !entry.resolved.file) {
				break;
			}
			const next = entry.resolved.file.path;
			if (seen.has(next)) {
				const cycleStart = chain.indexOf(next);
				cyclePath = chain.slice(cycleStart);
				break;
			}
			chain.push(next);
			seen.add(next);
			current = next;
			if (!redirects.has(next)) break;
		}

		if (cyclePath) {
			const key = [...cyclePath].sort().join('|');
			if (!reportedCycle.has(key)) {
				reportedCycle.add(key);
				issues.push(cycleIssue(cyclePath));
			}
		} else if (chain.length > 2 && !targetedPaths.has(startPath)) {
			issues.push(chainIssue(chain));
		}
	}

	return issues;
}

function checkReciprocals(state: RegistryState): HealthIssue[] {
	const { redirects, reciprocalClaims } = state;
	const issues: HealthIssue[] = [];

	for (const [stubPath, entry] of redirects) {
		// A broken heading/block fragment still names a real file, and that's
		// enough to check for a reciprocal declaration on it.
		if (!entry.resolved.file) continue;
		const canonicalPath = entry.resolved.file.path;
		const claims = reciprocalClaims.get(pathClaimKey(stubPath)) ?? [];
		const claimedBy = claims.filter((c) => c.claimant.path === canonicalPath);
		if (claimedBy.length === 0) {
			issues.push(missingReciprocalIssue(stubPath, canonicalPath));
		}
	}

	for (const claims of reciprocalClaims.values()) {
		for (const claim of claims) {
			// `related` carries the claim's exact raw wikilink text (not a
			// resolved path) so a repair command can remove precisely the
			// entry that is actually written in `redirects_from`.
			if (!claim.resolved.file) {
				issues.push(
					staleReciprocalIssue(
						claim.claimant.path,
						claim.target.raw,
						'that note cannot be resolved',
					),
				);
				continue;
			}

			const stubPath = claim.resolved.file.path;
			const stubEntry = redirects.get(stubPath);

			if (!stubEntry) {
				issues.push(
					staleReciprocalIssue(
						claim.claimant.path,
						claim.target.raw,
						'that note has no redirect_to declared',
					),
				);
				continue;
			}

			// Compare files, not exact status: a stub whose redirect_to has a
			// broken heading/block still identifies the right file, and that
			// fragment problem is already reported as its own broken-target
			// issue — it shouldn't also masquerade as a reciprocal mismatch.
			if (stubEntry.resolved.file?.path !== claim.claimant.path) {
				issues.push(
					staleReciprocalIssue(
						claim.claimant.path,
						claim.target.raw,
						"that note's redirect_to does not point back here",
					),
				);
			}
		}
	}

	return issues;
}

function checkDuplicateClaims(state: RegistryState): HealthIssue[] {
	const issues: HealthIssue[] = [];
	for (const claims of state.reciprocalClaims.values()) {
		const distinctClaimants = [...new Set(claims.map((c) => c.claimant.path))];
		if (distinctClaimants.length > 1) {
			const stubLabel = claims[0]!.resolved.file?.path ?? claims[0]!.target.path;
			issues.push(duplicateClaimIssue(stubLabel, distinctClaimants));
		}
	}
	return issues;
}

function checkPromotionCandidates(state: RegistryState): HealthIssue[] {
	const issues: HealthIssue[] = [];
	for (const [path, entry] of state.redirects) {
		if (entry.file.hasBodyContent) {
			issues.push(promotionCandidateIssue(path));
		}
	}
	return issues;
}
