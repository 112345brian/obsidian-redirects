/**
 * Pure "did the author just finish a bare wikilink" check for issue #10,
 * decoupled from the Obsidian `Editor` type so it's unit-testable. Only
 * triggers right as the closing `]]` is typed at the cursor, so existing
 * bare links elsewhere in the document are never touched — only what the
 * author is actively authoring right now.
 */

import { findBareWikilinks, isInsideCodeFence } from './detect';

export interface SwallowRewritePlan {
	from: number;
	to: number;
	term: string;
}

export function planSwallowRewrite(
	lineText: string,
	cursorCh: number,
	allLines: string[],
	lineIndex: number,
): SwallowRewritePlan | undefined {
	if (!lineText.slice(0, cursorCh).endsWith(']]')) return undefined;

	const match = findBareWikilinks(lineText).find((m) => m.to === cursorCh);
	if (!match) return undefined;

	if (isInsideCodeFence(allLines, lineIndex)) return undefined;

	return { from: match.from, to: match.to, term: match.term };
}
