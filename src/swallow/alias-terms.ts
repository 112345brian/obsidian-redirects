/**
 * Pure rule behind the swallow → alias sync: which swallowed terms a note
 * does not yet carry as aliases. No Obsidian imports, so it unit-tests
 * without the app; `alias-sync.ts` is the thin adapter that applies it.
 */

/** Terms not yet present (case-insensitively) in `aliases`, de-duplicated. */
export function termsMissingFromAliases(terms: string[], aliases: string[], ownName: string): string[] {
	const known = new Set(aliases.map((a) => a.trim().toLowerCase()));
	known.add(ownName.trim().toLowerCase());
	const missing: string[] = [];
	for (const term of terms) {
		const key = term.trim().toLowerCase();
		if (!key || known.has(key)) continue;
		known.add(key);
		missing.push(term.trim());
	}
	return missing;
}
