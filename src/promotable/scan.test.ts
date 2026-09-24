import { describe, expect, it } from 'vitest';
import { computePromotableTargets, normalizeKey } from './scan';

describe('computePromotableTargets', () => {
	it('surfaces a target referenced by at least the threshold of distinct sources', () => {
		const result = computePromotableTargets({
			'A.md': { 'R package': 1 },
			'B.md': { 'R package': 2 },
		});
		expect(result).toEqual([{ target: 'R package', sources: ['A.md', 'B.md'] }]);
	});

	it('excludes a target below the threshold', () => {
		const result = computePromotableTargets({ 'A.md': { 'Rare term': 1 } });
		expect(result).toEqual([]);
	});

	it('is case-insensitive and fragment/alias-insensitive when grouping', () => {
		const result = computePromotableTargets({
			'A.md': { 'r package#Install': 1 },
			'B.md': { 'R Package|pkg': 1 },
		});
		expect(result).toHaveLength(1);
		expect(result[0]?.sources).toEqual(['A.md', 'B.md']);
	});

	it('counts distinct sources, not occurrences', () => {
		const result = computePromotableTargets({ 'A.md': { Term: 5 } }, { threshold: 2 });
		expect(result).toEqual([]);
	});

	it('excludes links from ignored folders', () => {
		const result = computePromotableTargets(
			{ 'Templates/A.md': { Term: 1 }, 'B.md': { Term: 1 } },
			{ ignoredFolders: ['Templates'] },
		);
		expect(result).toEqual([]);
	});

	it('respects a configurable threshold', () => {
		const links = { 'A.md': { Term: 1 }, 'B.md': { Term: 1 }, 'C.md': { Term: 1 } };
		expect(computePromotableTargets(links, { threshold: 3 })).toHaveLength(1);
		expect(computePromotableTargets(links, { threshold: 4 })).toHaveLength(0);
	});

	it('excludes a dismissed target', () => {
		const result = computePromotableTargets(
			{ 'A.md': { Term: 1 }, 'B.md': { Term: 1 } },
			{ dismissed: new Set([normalizeKey('Term')]) },
		);
		expect(result).toEqual([]);
	});

	it('sorts by descending distinct-source count', () => {
		const result = computePromotableTargets({
			'A.md': { One: 1, Two: 1 },
			'B.md': { One: 1, Two: 1 },
			'C.md': { One: 1 },
		});
		expect(result.map((r) => r.target)).toEqual(['One', 'Two']);
	});
});

describe('normalizeKey', () => {
	it('strips alias and fragment, lowercases, and trims', () => {
		expect(normalizeKey(' Term#Heading|alias ')).toBe('term');
	});
});
