/**
 * Stub/canonical pairs behind the two-way sync and alias sync: every
 * (stub, canonical) relationship declared from *either* side, with which
 * sides declare it. Pure over a built `RegistryState`; nothing here touches
 * the vault.
 *
 * A declaration that can't be trusted is dropped rather than guessed at: a
 * `redirects-from` entry whose stub redirects somewhere else (a stale
 * reciprocal), or a stub claimed by several canonical notes (a duplicate
 * claim) when the stub itself doesn't say which one is right.
 */

import { RegistryState } from './state';
import { VaultNoteFile } from './types';

export interface RedirectPair {
	stub: VaultNoteFile;
	canonical: VaultNoteFile;
	/** The stub's own `redirects-to` resolves to the canonical note. */
	declaredByStub: boolean;
	/** The canonical note's `redirects-from` lists the stub. */
	declaredByCanonical: boolean;
}

export function computeRedirectPairs(state: RegistryState): RedirectPair[] {
	const pairs = new Map<string, RedirectPair>();
	const keyOf = (stubPath: string, canonicalPath: string) => `${stubPath}\n${canonicalPath}`;

	for (const [stubPath, entry] of state.redirects) {
		const canonical = entry.resolved.file;
		if (!canonical || canonical.path === stubPath) continue;
		pairs.set(keyOf(stubPath, canonical.path), {
			stub: entry.file,
			canonical,
			declaredByStub: true,
			declaredByCanonical: false,
		});
	}

	const claimantsByStub = new Map<string, { stub: VaultNoteFile; claimants: Map<string, VaultNoteFile> }>();
	for (const claims of state.reciprocalClaims.values()) {
		for (const claim of claims) {
			const stub = claim.resolved.file;
			if (!stub || stub.path === claim.claimant.path) continue;
			const group = claimantsByStub.get(stub.path) ?? { stub, claimants: new Map() };
			group.claimants.set(claim.claimant.path, claim.claimant);
			claimantsByStub.set(stub.path, group);
		}
	}

	for (const [stubPath, { stub, claimants }] of claimantsByStub) {
		const stubTarget = state.redirects.get(stubPath)?.resolved.file;
		if (stubTarget) {
			// The stub names its own destination; only a claimant that agrees counts.
			const pair = pairs.get(keyOf(stubPath, stubTarget.path));
			if (pair && claimants.has(stubTarget.path)) pair.declaredByCanonical = true;
			continue;
		}
		if (claimants.size !== 1) continue;
		const canonical = [...claimants.values()][0]!;
		pairs.set(keyOf(stubPath, canonical.path), {
			stub,
			canonical,
			declaredByStub: false,
			declaredByCanonical: true,
		});
	}

	return [...pairs.values()];
}
