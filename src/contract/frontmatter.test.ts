import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PROPERTY_KEYS,
	parseContract,
	setPropertyKeys,
	validatePropertyKey,
} from './frontmatter';

describe('parseContract', () => {
	it('returns empty result for missing frontmatter', () => {
		const result = parseContract(undefined);
		expect(result.redirectTo).toBeUndefined();
		expect(result.redirectsFrom).toEqual([]);
		expect(result.disambiguates).toEqual([]);
		expect(result.issues).toEqual([]);
	});

	it('parses a valid redirect-to', () => {
		const result = parseContract({ 'redirect-to': '[[Canonical note]]' });
		expect(result.redirectTo).toEqual({
			path: 'Canonical note',
			raw: '[[Canonical note]]',
		});
		expect(result.issues).toEqual([]);
	});

	it('parses redirects-from as a list of wikilinks', () => {
		const result = parseContract({
			'redirects-from': ['[[Old name]]', '[[Older name#Heading]]'],
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

	it('flags a non-string redirect-to', () => {
		const result = parseContract({ 'redirect-to': ['[[Note]]'] });
		expect(result.redirectTo).toBeUndefined();
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect-to', code: 'not-a-string' }),
		]);
	});

	it('flags an empty redirect-to', () => {
		const result = parseContract({ 'redirect-to': '   ' });
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect-to', code: 'empty-value' }),
		]);
	});

	it('flags a malformed redirect-to', () => {
		const result = parseContract({ 'redirect-to': 'Note without brackets' });
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirect-to', code: 'malformed-wikilink' }),
		]);
	});

	it('flags redirects-from when not a list', () => {
		const result = parseContract({ 'redirects-from': '[[Old name]]' });
		expect(result.redirectsFrom).toEqual([]);
		expect(result.issues).toEqual([
			expect.objectContaining({ property: 'redirects-from', code: 'not-a-list' }),
		]);
	});

	it('flags individual malformed entries in a list but keeps the valid ones', () => {
		const result = parseContract({
			'redirects-from': ['[[Valid]]', 'not a link', 42, ''],
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

describe('configurable property keys', () => {
	const legacy = { redirectTo: 'redirect_to', redirectsFrom: 'redirects_from' };

	it('defaults to hyphenated names and ignores the underscore forms', () => {
		const fm = { 'redirect-to': '[[A]]', 'redirects-from': ['[[B]]'] };
		const parsed = parseContract(fm);
		expect(parsed.redirectTo?.path).toBe('A');
		expect(parsed.redirectsFrom).toHaveLength(1);
		expect(parseContract({ redirect_to: '[[A]]' }).redirectTo).toBeUndefined();
	});

	it('reads custom names passed explicitly', () => {
		const parsed = parseContract({ redirect_to: '[[A]]', redirects_from: ['[[B]]'] }, legacy);
		expect(parsed.redirectTo?.path).toBe('A');
		expect(parsed.redirectsFrom).toHaveLength(1);
	});

	it('reads the active keys after setPropertyKeys', () => {
		setPropertyKeys(legacy);
		try {
			expect(parseContract({ redirect_to: '[[A]]' }).redirectTo?.path).toBe('A');
		} finally {
			setPropertyKeys(DEFAULT_PROPERTY_KEYS);
		}
	});

	it('rejects unusable or colliding names', () => {
		expect(validatePropertyKey('  ', 'x')).toBeUndefined();
		expect(validatePropertyKey('a b', 'x')).toBeUndefined();
		expect(validatePropertyKey('Swallows', 'x')).toBeUndefined();
		expect(validatePropertyKey('REDIRECTS-FROM', 'redirects-from')).toBeUndefined();
		expect(validatePropertyKey(' my-key ', 'x')).toBe('my-key');
	});
});
