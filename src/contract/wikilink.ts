/**
 * Parsing for native Obsidian wikilink syntax used as redirect/disambiguation
 * property values: `[[note]]`, `[[note#Heading]]`, `[[note#^block-id]]`, and
 * the `|alias` display-text suffix on any of those.
 */

export interface WikilinkTarget {
	/** Note path or name exactly as written inside the brackets, before `#`. */
	path: string;
	/** Heading text after `#`, when present (excludes block references). */
	heading?: string;
	/** Block id after `#^`, when present. */
	blockId?: string;
	/** Display text after `|`, when present. */
	alias?: string;
	/** The original `[[...]]` string this was parsed from. */
	raw: string;
}

const WIKILINK_PATTERN = /^\[\[([^[\]|]+)(?:\|([^[\]]*))?]]$/;

/**
 * Parses a single `[[...]]` wikilink string. Returns `null` if the input is
 * not a well-formed wikilink (wrong brackets, empty target, nested links).
 */
export function parseWikilink(value: string): WikilinkTarget | null {
	const raw = value.trim();
	const match = WIKILINK_PATTERN.exec(raw);
	if (!match) return null;

	const inner = match[1]?.trim();
	const alias = match[2]?.trim();
	if (!inner) return null;

	const hashIndex = inner.indexOf('#');
	if (hashIndex === -1) {
		return { path: inner, alias: alias || undefined, raw };
	}

	const path = inner.slice(0, hashIndex).trim();
	const fragment = inner.slice(hashIndex + 1).trim();
	if (!fragment) return null;

	if (fragment.startsWith('^')) {
		const blockId = fragment.slice(1).trim();
		if (!blockId) return null;
		return { path, blockId, alias: alias || undefined, raw };
	}

	return { path, heading: fragment, alias: alias || undefined, raw };
}

/** Formats a target back into canonical `[[...]]` wikilink syntax. */
export function formatWikilink(target: Omit<WikilinkTarget, 'raw'>): string {
	let inner = target.path;
	if (target.blockId) inner += `#^${target.blockId}`;
	else if (target.heading) inner += `#${target.heading}`;
	const alias = target.alias ? `|${target.alias}` : '';
	return `[[${inner}${alias}]]`;
}

/** Two targets refer to the same fragment of the same note. */
export function sameWikilinkTarget(
	a: Pick<WikilinkTarget, 'path' | 'heading' | 'blockId'>,
	b: Pick<WikilinkTarget, 'path' | 'heading' | 'blockId'>,
): boolean {
	return (
		normalizePath(a.path) === normalizePath(b.path) &&
		(a.heading ?? '').toLowerCase() === (b.heading ?? '').toLowerCase() &&
		(a.blockId ?? '') === (b.blockId ?? '')
	);
}

function normalizePath(path: string): string {
	return path.replace(/\.md$/i, '').toLowerCase();
}
