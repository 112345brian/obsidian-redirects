/**
 * Inserts a link line directly under a matched heading (issue #7's "link the
 * heading to a selected canonical note" action). Pure text transform so it's
 * unit-testable; the caller applies it via `Vault.process`. A no-op (returns
 * the input unchanged) if the heading text can't be found, rather than
 * guessing at a location.
 */
export function insertLinkAfterHeading(
	content: string,
	heading: string,
	linkLine: string,
): string {
	const lines = content.split('\n');
	const target = heading.trim().toLowerCase();
	const index = lines.findIndex((line) => headingText(line) === target);
	if (index === -1) return content;

	lines.splice(index + 1, 0, '', linkLine);
	return lines.join('\n');
}

function headingText(line: string): string {
	const match = /^#{1,6}\s+(.*)$/.exec(line.trim());
	return (match?.[1] ?? '').trim().toLowerCase();
}
