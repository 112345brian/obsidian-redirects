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
	claimKey,
} from './state';
import { VaultSource } from './types';

export type { RedirectEntry, DisambiguationEntry, ReciprocalClaim } from './state';

export class RedirectRegistry {
	private state: RegistryState = {
		redirects: new Map(),
		disambiguations: new Map(),
		reciprocalClaims: new Map(),
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
		}

		this.state = { redirects, disambiguations, reciprocalClaims };
		this.health = computeHealthIssues(this.state);
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
}
