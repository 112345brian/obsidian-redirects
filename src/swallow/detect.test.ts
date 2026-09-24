import { describe, expect, it } from 'vitest';
import { findBareWikilinks, isInsideCodeFence } from './detect';

describe('findBareWikilinks', () => {
	it('finds a single bare wikilink', () => {
		const result = findBareWikilinks('See [[R package]] for details.');
		expect(result).toEqual([{ from: 4, to: 17, term: 'R package' }]);
	});

	it('ignores a link with an alias', () => {
		expect(findBareWikilinks('[[R package|pkg]]')).toEqual([]);
	});

	it('ignores a link with a heading fragment', () => {
		expect(findBareWikilinks('[[R package#Install]]')).toEqual([]);
	});

	it('ignores a path-qualified link', () => {
		expect(findBareWikilinks('[[folder/R package]]')).toEqual([]);
	});

	it('finds multiple bare links on one line', () => {
		const result = findBareWikilinks('[[One]] and [[Two]]');
		expect(result.map((m) => m.term)).toEqual(['One', 'Two']);
	});

	it('ignores an empty link', () => {
		expect(findBareWikilinks('[[]]')).toEqual([]);
	});
});

describe('isInsideCodeFence', () => {
	it('is false above the first fence', () => {
		const lines = ['text', '```', 'code', '```', 'text'];
		expect(isInsideCodeFence(lines, 0)).toBe(false);
	});

	it('is true for lines inside a fence', () => {
		const lines = ['text', '```', 'code', '```', 'text'];
		expect(isInsideCodeFence(lines, 2)).toBe(true);
	});

	it('is false again after the closing fence', () => {
		const lines = ['text', '```', 'code', '```', 'text'];
		expect(isInsideCodeFence(lines, 4)).toBe(false);
	});

	it('treats ~~~ fences the same as backtick fences', () => {
		const lines = ['~~~', 'code', '~~~', 'text'];
		expect(isInsideCodeFence(lines, 1)).toBe(true);
		expect(isInsideCodeFence(lines, 3)).toBe(false);
	});
});
