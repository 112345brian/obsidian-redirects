import { describe, expect, it } from 'vitest';
import { parseContract } from './frontmatter';

describe('parseContract', () => {
	it('returns empty result for missing frontmatter', () => {
		const result = parseContract(undefined);
		expect(result.redirectTo).toBeUndefined();
		expect(result.redirectsFrom).toEqual([]);
		expect(result.disambiguates).toEqual([]);
		expect(result.issues).toEqual([]);
	});

	it('parses a valid redirect_to', () => {
		const result = parseContract({ redirect_to: '[[Canonical note]]' });
		expect(result.redirectTo).toEqual({
			path: 'Canonical note',
			raw: '[[Canonical note]]',
		});
		expect(result.issues).toEqual([]);
	});

	it('parses redirects_from as a list of wikilinks', () => {
		const result = parseContract({
			redirects_from: ['[[Old name]]', '[[Older name#Heading]]'],
		});
		expect(result.redirectsFrom).toHaveLength(2);
		expect(result.redirectsFrom[0]!.path).toBe('Old name');
		expect(result.redirectsFrom[1]!.heading).toBe('Heading');
		expect(result.issues).toEqual([]);
	});

	it('parses disambiguates as a list of wikilinks', () => {
		const result = parseContract({
			disambiguates: ['[[Candidate A]]', '[[Candidate B]]'],
		});
		expect(result.disambiguates).toHaveLength(2);
		expect(result.issues).toEqual([]);
	});

	it('flags a non-string redirect_to', () => {
		const result = parseContract({ redirect_to: ['[[Note]]'] });
		expect(result.redirectTo).toBeUndefined();
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect_to', code: 'not-a-string' }),
		]);
	});

	it('flags an empty redirect_to', () => {
		const result = parseContract({ redirect_to: '   ' });
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect_to', code: 'empty-value' }),
		]);
	});

	it('flags a malformed redirect_to', () => {
		const result = parseContract({ redirect_to: 'Note without brackets' });
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect_to', code: 'malformed-wikilink' }),
		]);
	});

	it('flags redirects_from when not a list', () => {
		const result = parseContract({ redirects_from: '[[Old name]]' });
		expect(result.redirectsFrom).toEqual([]);
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirects_from', code: 'not-a-list' }),
		]);
	});

	it('flags individual malformed entries in a list but keeps the valid ones', () => {
		const result = parseContract({
			redirects_from: ['[[Valid]]', 'not a link', 42, ''],
		});
		expect(result.redirectsFrom).toHaveLength(1);
		expect(result.redirectsFrom[0]!.path).toBe('Valid');
		expect(result.issues.map((i) => i.code)).toEqual([
			'malformed-wikilink',
			'not-a-string',
			'empty-value',
		]);
	});

	it('parses swallows as a list of literal terms, not wikilinks', () => {
		const result = parseContract({ swallows: ['R package', 'CRAN package'] });
		expect(result.swallows).toEqual(['R package', 'CRAN package']);
		expect(result.issues).toEqual([]);
	});

	it('flags swallows when not a list', () => {
		const result = parseContract({ swallows: 'R package' });
		expect(result.swallows).toEqual([]);
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'swallows', code: 'not-a-list' }),
		]);
	});

	it('flags non-string and empty swallows entries but keeps the valid ones', () => {
		const result = parseContract({ swallows: ['Valid term', 42, '  '] });
		expect(result.swallows).toEqual(['Valid term']);
		expect(result.issues.map((i) => i.code)).toEqual(['not-a-string', 'empty-value']);
	});
});
