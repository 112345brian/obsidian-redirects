/**
 * Pure whole-file rewrite for the swallow-claim fix-on-save (issue #10):
 * replaces every bare `[[term]]` occurrence (exact, case-sensitive — a
 * swallow claim is a literal display term) with a path-qualified
 * `[[canonicalPath|term]]`, skipping fenced code blocks. Used to fix an
 * entire note's content in one pass rather than one link at a time.
 */

import { findBareWikilinks, isInsideCodeFence } from './detect';

export interface QualifyResult {
	content: string;
	/** Number of occurrences rewritten. */
	count: number;
}

export function qualifyBareLinksInContent(
	content: string,
	term: string,
	canonicalPath: string,
): QualifyResult {
	const lines = content.split('\n');
	let count = 0;

	const rewritten = lines.map((line, index) => {
		if (isInsideCodeFence(lines, index)) return line;

		const matches = findBareWikilinks(line).filter((m) => m.term === term);
		if (matches.length === 0) return line;

		let newLine = line;
		// Rewrite back-to-front so earlier matches' offsets stay valid.
		for (let i = matches.length - 1; i >= 0; i--) {
			const match = matches[i]!;
			newLine = `${newLine.slice(0, match.from)}[[${canonicalPath}|${term}]]${newLine.slice(match.to)}`;
			count++;
		}
		return newLine;
	});

	return { content: rewritten.join('\n'), count };
}
