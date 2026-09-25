/**
 * The cached routing registry (issue #2): a single, incrementally rebuilt
 * view over every note's redirect/disambiguation contract, plus a read-only
 * health report. Building the registry never mutates vault files.
 */

import { parseContract } from '../contract/frontmatter';
import { computeHealthIssues } from './health-checks';
import { HealthIssue } from './health';
import { ResolvedTarget, VaultIndex, resolveTarget } from './resolver';
import {
	DisambiguationEntry,
	RedirectEntry,
	ReciprocalClaim,
	RegistryState,
	SwallowClaim,
	claimKey,
} from './state';
import { VaultSource } from './types';

export type { RedirectEntry, DisambiguationEntry, ReciprocalClaim, SwallowClaim } from './state';

export interface SwallowResolution {
	status: 'none' | 'unambiguous' | 'ambiguous' | 'collides-with-note';
	canonicalPath?: string;
	/** Every valid claimant path, when status is 'ambiguous'. */
	candidatePaths?: string[];
	/** Other notes that already declare this exact term as an alias, when
	 * status is 'unambiguous' — the claim doesn't collide with a real note's
	 * filename, but it does compete with an existing, unrelated alias that
	 * Obsidian's own resolver would otherwise treat as equally valid. */
	aliasConflictPaths?: string[];
}

export class RedirectRegistry {
	private state: RegistryState = {
		redirects: new Map(),
		disambiguations: new Map(),
		reciprocalClaims: new Map(),
		swallowClaims: new Map(),
		invalidSwallowClaims: [],
	};
	private health: HealthIssue[] = [];
	private index: VaultIndex;

	constructor(source: VaultSource) {
		this.index = new VaultIndex([]);
		this.rebuild(source);
	}

	/** Rebuilds the whole registry from the current vault state. */
	rebuild(source: VaultSource): void {
		const files = source.getFiles();
		this.index = new VaultIndex(files);

		const redirects = new Map<string, RedirectEntry>();
		const disambiguations = new Map<string, DisambiguationEntry>();
		const reciprocalClaims = new Map<string, ReciprocalClaim[]>();
		const swallowClaims = new Map<string, SwallowClaim[]>();
		const invalidSwallowClaims: SwallowClaim[] = [];

		for (const file of files) {
			const contract = parseContract(file.frontmatter);

			if (contract.redirectTo) {
				redirects.set(file.path, {
					file,
					resolved: resolveTarget(contract.redirectTo, this.index),
				});
			}

			if (contract.disambiguates.length > 0) {
				disambiguations.set(file.path, {
					file,
					candidates: contract.disambiguates.map((t) =>
						resolveTarget(t, this.index),
					),
				});
			}

			if (contract.redirectsFrom.length > 0) {
				for (const target of contract.redirectsFrom) {
					const resolved = resolveTarget(target, this.index);
					const claim: ReciprocalClaim = {
						claimant: file,
						target,
						resolved,
					};
					const key = claimKey(resolved, target);
					const existing = reciprocalClaims.get(key);
					if (existing) existing.push(claim);
					else reciprocalClaims.set(key, [claim]);
				}
			}

			if (contract.swallows.length > 0) {
				// Only a canonical note (neither a redirect stub nor a
				// disambiguation page) may claim a term.
				const isValidClaimant = !contract.redirectTo && contract.disambiguates.length === 0;
				for (const term of contract.swallows) {
					const claim: SwallowClaim = { claimant: file, term };
					if (!isValidClaimant) {
						invalidSwallowClaims.push(claim);
						continue;
					}
					const existing = swallowClaims.get(term);
					if (existing) existing.push(claim);
					else swallowClaims.set(term, [claim]);
				}
			}
		}

		this.state = {
			redirects,
			disambiguations,
			reciprocalClaims,
			swallowClaims,
			invalidSwallowClaims,
		};
		this.health = computeHealthIssues(this.state, this.index);
	}

	getRedirect(path: string): RedirectEntry | undefined {
		return this.state.redirects.get(path);
	}

	getDisambiguation(path: string): DisambiguationEntry | undefined {
		return this.state.disambiguations.get(path);
	}

	/** Resolves a stub through as many redirect hops as needed. */
	resolveFinalTarget(path: string, maxHops = 50): ResolvedTarget | undefined {
		const { redirects } = this.state;
		let current = path;
		const seen = new Set<string>();
		let last: RedirectEntry | undefined;

		for (let hop = 0; hop < maxHops; hop++) {
			if (seen.has(current)) return last?.resolved;
			seen.add(current);

			const entry = redirects.get(current);
			if (!entry) return last?.resolved;
			last = entry;

			if (entry.resolved.status !== 'resolved' || !entry.resolved.file) {
				return entry.resolved;
			}

			const nextPath = entry.resolved.file.path;
			if (!redirects.has(nextPath)) return entry.resolved;
			current = nextPath;
		}

		return last?.resolved;
	}

	getHealthReport(): HealthIssue[] {
		return this.health;
	}

	/**
	 * Resolves a literal display term against swallow claims (issue #10). A
	 * term that already names a real, different note is 'collides-with-note'
	 * — the claim can never safely override an existing file, so callers must
	 * never auto-rewrite in that case.
	 */
	getSwallowResolution(term: string): SwallowResolution {
		const trimmed = term.trim();
		if (!trimmed) return { status: 'none' };

		const claims = this.state.swallowClaims.get(trimmed) ?? [];
		const claimantPaths = new Set(claims.map((c) => c.claimant.path));

		const collidingRealFile = this.index
			.findByBasename(trimmed)
			.find((file) => !claimantPaths.has(file.path));
		if (collidingRealFile) {
			return { status: 'collides-with-note', canonicalPath: collidingRealFile.path };
		}

		if (claims.length === 0) return { status: 'none' };
		if (claims.length > 1) {
			return { status: 'ambiguous', candidatePaths: claims.map((c) => c.claimant.path) };
		}

		const canonicalPath = claims[0]!.claimant.path;
		const aliasConflictPaths = this.getAliasConflictPaths(trimmed, canonicalPath);

		return {
			status: 'unambiguous',
			canonicalPath,
			...(aliasConflictPaths.length > 0 ? { aliasConflictPaths } : {}),
		};
	}

	/** Other notes that already declare `term` as an alias, excluding `path`
	 * itself. Shared by `getSwallowResolution`'s unambiguous branch and by
	 * callers checking the specific candidate an ambiguous chooser picked. */
	getAliasConflictPaths(term: string, path: string): string[] {
		return this.index
			.findByAlias(term.trim())
			.map((file) => file.path)
			.filter((p) => p !== path);
	}
}
