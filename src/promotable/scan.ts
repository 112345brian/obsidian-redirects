/**
 * Pure detection logic for promotable unresolved links (issue #6): an
 * unresolved link target referenced by at least `threshold` distinct source
 * notes is a cue, not an error — nothing here creates or changes anything.
 */

export interface PromotableTarget {
	/** The unresolved link text as most recently seen (display form). */
	target: string;
	/** Distinct source note paths that reference it. */
	sources: string[];
}

/**
 * `unresolvedLinks` mirrors Obsidian's `MetadataCache.unresolvedLinks`:
 * source path -> { linkText: occurrence count }.
 */
export function computePromotableTargets(
	unresolvedLinks: Record<string, Record<string, number>>,
	options: {
		threshold?: number;
		ignoredFolders?: string[];
		dismissed?: Set<string>;
	} = {},
): PromotableTarget[] {
	const threshold = options.threshold ?? 2;
	const ignoredFolders = options.ignoredFolders ?? [];
	const dismissed = options.dismissed ?? new Set<string>();

	const bySources = new Map<string, { display: string; sources: Set<string> }>();

	for (const [sourcePath, links] of Object.entries(unresolvedLinks)) {
		if (isIgnored(sourcePath, ignoredFolders)) continue;

		for (const linkText of Object.keys(links)) {
			const key = normalizeKey(linkText);
			if (dismissed.has(key)) continue;

			const entry = bySources.get(key);
			if (entry) {
				entry.sources.add(sourcePath);
			} else {
				bySources.set(key, { display: linkText, sources: new Set([sourcePath]) });
			}
		}
	}

	const results: PromotableTarget[] = [];
	for (const { display, sources } of bySources.values()) {
		if (sources.size >= threshold) {
			results.push({ target: display, sources: [...sources].sort() });
		}
	}

	return results.sort((a, b) => b.sources.length - a.sources.length || a.target.localeCompare(b.target));
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
	return ignoredFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
}

export function normalizeKey(linkText: string): string {
	// Strip a heading/block fragment and any alias — the note-level target is
	// what's promotable, regardless of which fragment a given link asked for.
	const withoutAlias = linkText.split('|')[0] ?? linkText;
	const withoutFragment = withoutAlias.split('#')[0] ?? withoutAlias;
	return withoutFragment.trim().toLowerCase();
}
