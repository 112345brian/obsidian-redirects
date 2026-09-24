/** Pure filter for removing one alias entry (case-insensitively) from a
 * note's `aliases` frontmatter value, used by the alias-conflict consolidate
 * action (issue #10 follow-up). */
export function withAliasRemoved(aliases: unknown, term: string): string[] {
	if (!Array.isArray(aliases)) return [];
	const target = term.trim().toLowerCase();
	return aliases.filter(
		(a): a is string => typeof a === 'string' && a.trim().toLowerCase() !== target,
	);
}
