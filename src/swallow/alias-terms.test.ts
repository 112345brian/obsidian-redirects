import { describe, expect, it } from 'vitest';
import { termsMissingFromAliases } from './alias-terms';

describe('termsMissingFromAliases', () => {
	it('returns terms that are not yet aliases', () => {
		expect(termsMissingFromAliases(['R package', 'rlang'], ['rlang'], 'R')).toEqual(['R package']);
	});

	it('matches case-insensitively and ignores surrounding whitespace', () => {
		expect(termsMissingFromAliases([' R Package '], ['r package'], 'R')).toEqual([]);
	});

	it('skips a term equal to the note\'s own name and de-duplicates', () => {
		expect(termsMissingFromAliases(['R', 'x', 'X'], [], 'r')).toEqual(['x']);
	});

	it('returns nothing for no terms', () => {
		expect(termsMissingFromAliases([], ['a'], 'R')).toEqual([]);
	});
});
