import { describe, expect, it } from 'vitest';
import { qualifyBareLinksInContent } from './qualify-content';

describe('qualifyBareLinksInContent', () => {
	it('qualifies a single bare occurrence', () => {
		const result = qualifyBareLinksInContent('See [[R package]] for details.', 'R package', 'software-library');
		expect(result).toEqual({
			content: 'See [[software-library|R package]] for details.',
			count: 1,
		});
	});

	it('qualifies multiple occurrences on the same line', () => {
		const result = qualifyBareLinksInContent('[[R package]] and [[R package]]', 'R package', 'lib');
		expect(result.count).toBe(2);
		expect(result.content).toBe('[[lib|R package]] and [[lib|R package]]');
	});

	it('qualifies occurrences across multiple lines', () => {
		const content = '[[R package]]\nsomething else\n[[R package]]';
		const result = qualifyBareLinksInContent(content, 'R package', 'lib');
		expect(result.count).toBe(2);
		expect(result.content).toBe('[[lib|R package]]\nsomething else\n[[lib|R package]]');
	});

	it('leaves non-matching terms untouched', () => {
		const content = '[[Other term]]';
		const result = qualifyBareLinksInContent(content, 'R package', 'lib');
		expect(result).toEqual({ content, count: 0 });
	});

	it('leaves already-qualified or aliased links untouched', () => {
		const content = '[[lib|R package]] and [[R package|alias]]';
		const result = qualifyBareLinksInContent(content, 'R package', 'lib');
		expect(result).toEqual({ content, count: 0 });
	});

	it('skips occurrences inside fenced code blocks', () => {
		const content = '```\n[[R package]]\n```\n[[R package]]';
		const result = qualifyBareLinksInContent(content, 'R package', 'lib');
		expect(result.count).toBe(1);
		expect(result.content).toBe('```\n[[R package]]\n```\n[[lib|R package]]');
	});

	it('matches case-sensitively, since a swallow claim is a literal term', () => {
		const content = '[[r package]]';
		const result = qualifyBareLinksInContent(content, 'R package', 'lib');
		expect(result).toEqual({ content, count: 0 });
	});
});
