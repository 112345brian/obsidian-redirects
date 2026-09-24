import { describe, expect, it } from 'vitest';
import { withAliasRemoved } from './consolidate';

describe('withAliasRemoved', () => {
	it('removes a matching alias case-insensitively', () => {
		expect(withAliasRemoved(['R Package', 'Other'], 'r package')).toEqual(['Other']);
	});

	it('leaves non-matching aliases untouched', () => {
		expect(withAliasRemoved(['One', 'Two'], 'Three')).toEqual(['One', 'Two']);
	});

	it('returns an empty list for a non-array value', () => {
		expect(withAliasRemoved(undefined, 'Term')).toEqual([]);
		expect(withAliasRemoved('Term', 'Term')).toEqual([]);
	});
});
