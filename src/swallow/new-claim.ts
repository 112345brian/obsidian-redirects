/**
 * Pure logic for the "just declared a new swallow claim" moment (issue #10):
 * unlike an individual new link against an already-established claim (fixed
 * silently, linter-style), declaring the claim itself can retroactively
 * affect every existing unqualified link vault-wide — a potentially large,
 * multi-file effect that gets a preview and explicit confirmation, the same
 * as every other mutation in this plugin.
 */

/** Terms present in `current` that weren't in `previous` (or `previous` is
 * absent, e.g. a file seen for the first time — a first-time claim is new,
 * but the initial vault-wide seeding pass must call this with the file's
 * own current terms as `previous` so it does not look "newly added"). */
export function computeNewlyAddedTerms(previous: Set<string> | undefined, current: string[]): string[] {
	const prior = previous ?? new Set<string>();
	return current.filter((term) => !prior.has(term));
}

export interface BareOccurrence {
	path: string;
	count: number;
}

/** Every file with at least one bare (unqualified) occurrence of `term`,
 * from Obsidian's own `metadataCache.unresolvedLinks` — no extra scanning. */
export function findBareOccurrences(
	unresolvedLinks: Record<string, Record<string, number>>,
	term: string,
): BareOccurrence[] {
	const results: BareOccurrence[] = [];
	for (const [path, links] of Object.entries(unresolvedLinks)) {
		const count = links[term];
		if (count) results.push({ path, count });
	}
	return results.sort((a, b) => a.path.localeCompare(b.path));
}
