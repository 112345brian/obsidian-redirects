/**
 * Pure text-level detection for the authoring-time swallow rewrite (issue
 * #10): finds a just-completed *bare* `[[Term]]` wikilink on a line — no
 * alias, no heading/block fragment, no path separator — since only that
 * unqualified form is a candidate for path-qualification. Explicit
 * path-qualified links, aliased links, and fragment links are left alone.
 */

export interface BareWikilinkMatch {
	/** Character offset of the opening `[[` on the line. */
	from: number;
	/** Character offset just past the closing `]]` on the line. */
	to: number;
	/** The literal text between the brackets, trimmed. */
	term: string;
}

const BARE_WIKILINK = /\[\[([^[\]|#/]+)]]/g;

export function findBareWikilinks(lineText: string): BareWikilinkMatch[] {
	const matches: BareWikilinkMatch[] = [];
	BARE_WIKILINK.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = BARE_WIKILINK.exec(lineText))) {
		const term = match[1]!.trim();
		if (term) {
			matches.push({ from: match.index, to: match.index + match[0].length, term });
		}
	}
	return matches;
}

/** True when `lineIndex` sits inside a ``` fenced code block, based on the
 * number of fence lines above it. A cheap, doc-wide-scan-free heuristic. */
export function isInsideCodeFence(lines: string[], lineIndex: number): boolean {
	let fenced = false;
	for (let i = 0; i < lineIndex && i < lines.length; i++) {
		if (/^\s*(```|~~~)/.test(lines[i]!)) fenced = !fenced;
	}
	return fenced;
}
