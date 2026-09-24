import { describe, expect, it } from 'vitest';
import { formatWikilink, parseWikilink } from './wikilink';

describe('parseWikilink', () => {
	it('parses a plain note link', () => {
		expect(parseWikilink('[[Canonical note]]')).toEqual({
			path: 'Canonical note',
			raw: '[[Canonical note]]',
		});
	});

	it('parses a heading link', () => {
		expect(parseWikilink('[[Note#Heading text]]')).toEqual({
			path: 'Note',
			heading: 'Heading text',
			raw: '[[Note#Heading text]]',
		});
	});

	it('parses a block link', () => {
		expect(parseWikilink('[[Note#^abc123]]')).toEqual({
			path: 'Note',
			blockId: 'abc123',
			raw: '[[Note#^abc123]]',
		});
	});

	it('parses an alias suffix on a plain link', () => {
		expect(parseWikilink('[[Note|Display text]]')).toEqual({
			path: 'Note',
			alias: 'Display text',
			raw: '[[Note|Display text]]',
		});
	});

	it('parses an alias suffix on a heading link', () => {
		expect(parseWikilink('[[Note#Heading|Display]]')).toEqual({
			path: 'Note',
			heading: 'Heading',
			alias: 'Display',
			raw: '[[Note#Heading|Display]]',
		});
	});

	it('parses a nested path', () => {
		expect(parseWikilink('[[folder/Sub Note]]')).toEqual({
			path: 'folder/Sub Note',
			raw: '[[folder/Sub Note]]',
		});
	});

	it.each([
		['missing brackets', 'Note'],
		['single bracket', '[Note]'],
		['empty target', '[[]]'],
		['empty heading fragment', '[[Note#]]'],
		['empty block fragment', '[[Note#^]]'],
		['nested wikilink', '[[Note [[Other]]]]'],
	])('returns null for %s', (_label, input) => {
		expect(parseWikilink(input)).toBeNull();
	});
});

describe('formatWikilink', () => {
	it('round-trips a plain target', () => {
		expect(formatWikilink({ path: 'Note' })).toBe('[[Note]]');
	});

	it('round-trips a heading target with alias', () => {
		expect(
			formatWikilink({ path: 'Note', heading: 'Heading', alias: 'Text' }),
		).toBe('[[Note#Heading|Text]]');
	});

	it('round-trips a block target', () => {
		expect(formatWikilink({ path: 'Note', blockId: 'abc123' })).toBe(
			'[[Note#^abc123]]',
		);
	});
});
