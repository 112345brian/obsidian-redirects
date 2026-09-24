/**
 * Pure redirect-navigation planning (issue #3): given a registry and the path
 * of a file that was just opened, decides whether to follow a redirect, and
 * detects loops/broken targets before anything navigates. No Obsidian API
 * dependency, so this is unit-testable without a running app.
 */

import { ResolvedTarget } from '../registry/resolver';
import { RedirectRegistry } from '../registry/registry';

export type NavigationOutcome =
	| { kind: 'not-a-redirect' }
	| { kind: 'navigate'; target: ResolvedTarget; chain: string[] }
	| { kind: 'cycle'; chain: string[] }
	| { kind: 'broken'; chain: string[]; final: ResolvedTarget };

/**
 * Walks the redirect chain starting at `path`. Returns 'navigate' as soon as
 * the chain reaches a file that is not itself a redirect stub (the routing
 * behavior stops there, whether or not the requested fragment on it exists —
 * a missing heading/block is reported by the health checks, not here).
 */
export function planNavigation(
	registry: RedirectRegistry,
	path: string,
	maxHops = 50,
): NavigationOutcome {
	let current = registry.getRedirect(path);
	if (!current) return { kind: 'not-a-redirect' };

	const chain: string[] = [path];
	const seen = new Set<string>([path]);

	for (let hop = 0; hop < maxHops; hop++) {
		if (current.resolved.status !== 'resolved' || !current.resolved.file) {
			return { kind: 'broken', chain, final: current.resolved };
		}

		const nextPath = current.resolved.file.path;
		if (seen.has(nextPath)) {
			return { kind: 'cycle', chain: [...chain, nextPath] };
		}

		const nextEntry = registry.getRedirect(nextPath);
		if (!nextEntry) {
			return { kind: 'navigate', target: current.resolved, chain };
		}

		chain.push(nextPath);
		seen.add(nextPath);
		current = nextEntry;
	}

	return { kind: 'cycle', chain };
}
