/**
 * Pure frontmatter-mutation helpers for the authoring/repair commands (issue
 * #5). Each function computes a new value from an existing (possibly absent
 * or malformed) property value; nothing here touches the vault — callers
 * apply the result via `app.fileManager.processFrontMatter`, which is what
 * actually writes the file and participates in Obsidian's own file history.
 */

import { WikilinkTarget, formatWikilink } from '../contract/wikilink';

export function normalizeWikilinkList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === 'string');
}

/** Adds `target` to a wikilink-list property, unless an identical entry is
 * already present. Order and existing entries are otherwise preserved. */
export function withWikilinkAdded(
	existing: unknown,
	target: WikilinkTarget,
): string[] {
	const list = normalizeWikilinkList(existing);
	const raw = formatWikilink(target);
	if (list.includes(raw)) return list;
	return [...list, raw];
}

/** Removes every entry equal to `raw` from a wikilink-list property. */
export function withWikilinkRemoved(existing: unknown, raw: string): string[] {
	return normalizeWikilinkList(existing).filter((v) => v !== raw);
}

/** The frontmatter block for a brand-new redirect stub note. */
export function stubFrontmatterText(
	redirectToKey: string,
	target: WikilinkTarget,
): string {
	return `---\n${redirectToKey}: "${formatWikilink(target)}"\n---\n`;
}
