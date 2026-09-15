import { WikilinkTarget, formatWikilink } from '../contract/wikilink';

export type HealthIssueType =
	| 'broken-target'
	| 'redirect-cycle'
	| 'redirect-chain'
	| 'missing-reciprocal'
	| 'stale-reciprocal'
	| 'duplicate-claim'
	| 'promotion-candidate';

export interface HealthIssue {
	type: HealthIssueType;
	/** The note this issue is reported against. */
	path: string;
	message: string;
	/** Other paths involved (chain members, the other claimant, etc). */
	related?: string[];
}

export function brokenTargetIssue(
	path: string,
	property: string,
	target: WikilinkTarget,
	reason: string,
): HealthIssue {
	return {
		type: 'broken-target',
		path,
		message: `${property} ${formatWikilink(target)} ${reason}.`,
	};
}

export function cycleIssue(cycle: string[]): HealthIssue {
	return {
		type: 'redirect-cycle',
		path: cycle[0]!,
		message: `Redirect cycle: ${cycle.join(' -> ')} -> ${cycle[0]}.`,
		related: cycle,
	};
}

export function chainIssue(chain: string[]): HealthIssue {
	return {
		type: 'redirect-chain',
		path: chain[0]!,
		message: `Redirect chain (${chain.length} hops): ${chain.join(' -> ')}.`,
		related: chain,
	};
}

export function missingReciprocalIssue(
	stubPath: string,
	canonicalPath: string,
): HealthIssue {
	return {
		type: 'missing-reciprocal',
		path: canonicalPath,
		message: `"${canonicalPath}" does not list "${stubPath}" in redirects_from, but "${stubPath}" redirects to it.`,
		related: [stubPath],
	};
}

export function staleReciprocalIssue(
	canonicalPath: string,
	claimedStubPath: string,
	reason: string,
): HealthIssue {
	return {
		type: 'stale-reciprocal',
		path: canonicalPath,
		message: `"${canonicalPath}" claims "${claimedStubPath}" in redirects_from, but ${reason}.`,
		related: [claimedStubPath],
	};
}

export function duplicateClaimIssue(
	stubPath: string,
	claimants: string[],
): HealthIssue {
	return {
		type: 'duplicate-claim',
		path: stubPath,
		message: `"${stubPath}" is claimed as a redirect source by multiple notes: ${claimants.join(', ')}.`,
		related: claimants,
	};
}

export function promotionCandidateIssue(path: string): HealthIssue {
	return {
		type: 'promotion-candidate',
		path,
		message: `"${path}" is a redirect stub with body content; consider promoting it to a canonical note.`,
	};
}
