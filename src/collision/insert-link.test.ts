import { describe, expect, it } from 'vitest';
import { insertLinkAfterHeading } from './insert-link';

describe('insertLinkAfterHeading', () => {
	it('inserts the link line right after the matching heading', () => {
		const content = '# Title\n\n## Partial pooling\n\nSome text.\n';
		const result = insertLinkAfterHeading(content, 'Partial pooling', '[[Partial pooling (canonical)]]');
		expect(result).toBe(
			'# Title\n\n## Partial pooling\n\n[[Partial pooling (canonical)]]\n\nSome text.\n',
		);
	});

	it('matches the heading text case-insensitively', () => {
		const content = '## partial pooling\nbody';
		const result = insertLinkAfterHeading(content, 'Partial Pooling', '[[X]]');
		expect(result).toContain('## partial pooling\n\n[[X]]\nbody');
	});

	it('returns the content unchanged when the heading is not found', () => {
		const content = '## Something else\nbody';
		expect(insertLinkAfterHeading(content, 'Missing heading', '[[X]]')).toBe(content);
	});
});
