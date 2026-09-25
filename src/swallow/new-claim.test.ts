import { describe, expect, it } from 'vitest';
import { computeNewlyAddedTerms, findBareOccurrences } from './new-claim';

describe('computeNewlyAddedTerms', () => {
	it('returns terms not present before', () => {
		expect(computeNewlyAddedTerms(new Set(['A']), ['A', 'B'])).toEqual(['B']);
	});

	it('treats an absent previous set as empty (first time seen)', () => {
		expect(computeNewlyAddedTerms(undefined, ['A'])).toEqual(['A']);
	});

	it('returns nothing when nothing changed', () => {
		expect(computeNewlyAddedTerms(new Set(['A', 'B']), ['A', 'B'])).toEqual([]);
	});

	it('returns nothing when a term was removed rather than added', () => {
		expect(computeNewlyAddedTerms(new Set(['A', 'B']), ['A'])).toEqual([]);
	});
});

describe('findBareOccurrences', () => {
	it('finds every file with a bare occurrence of the term', () => {
		const result = findBareOccurrences(
			{ 'A.md': { 'R package': 2 }, 'B.md': { Other: 1 }, 'C.md': { 'R package': 1 } },
			'R package',
		);
		expect(result).toEqual([
			{ path: 'A.md', count: 2 },
			{ path: 'C.md', count: 1 },
		]);
	});

	it('returns an empty list when no file has the term', () => {
		expect(findBareOccurrences({ 'A.md': { Other: 1 } }, 'R package')).toEqual([]);
	});
});
