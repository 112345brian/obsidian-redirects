import { describe, expect, it } from 'vitest';
import {
	normalizeWikilinkList,
	stubFrontmatterText,
	withAliasAdded,
	withWikilinkAdded,
	withWikilinkRemoved,
} from './mutations';

describe('normalizeWikilinkList', () => {
	it('drops non-string entries and non-array values', () => {
		expect(normalizeWikilinkList(['[[A]]', 1, null, '[[B]]'])).toEqual(['[[A]]', '[[B]]']);
		expect(normalizeWikilinkList(undefined)).toEqual([]);
		expect(normalizeWikilinkList('[[A]]')).toEqual([]);
	});
});

describe('withWikilinkAdded', () => {
	it('appends a new target', () => {
		expect(withWikilinkAdded(['[[A]]'], { path: 'B', raw: '[[B]]' })).toEqual([
			'[[A]]',
			'[[B]]',
		]);
	});

	it('is a no-op when the exact target is already present', () => {
		expect(withWikilinkAdded(['[[A]]'], { path: 'A', raw: '[[A]]' })).toEqual(['[[A]]']);
	});

	it('starts a fresh list when the existing value is absent', () => {
		expect(withWikilinkAdded(undefined, { path: 'A', raw: '[[A]]' })).toEqual(['[[A]]']);
	});
});

describe('withWikilinkRemoved', () => {
	it('removes only the matching raw entry', () => {
		expect(withWikilinkRemoved(['[[A]]', '[[B]]'], '[[A]]')).toEqual(['[[B]]']);
	});
});

describe('stubFrontmatterText', () => {
	it('renders a redirects-to frontmatter block', () => {
		expect(stubFrontmatterText('redirects-to', { path: 'Canonical', raw: '[[Canonical]]' })).toBe(
			'---\nredirects-to: "[[Canonical]]"\n---\n',
		);
	});
});

describe('withAliasAdded', () => {
	it('appends a new alias, keeping existing ones', () => {
		expect(withAliasAdded(['One'], 'Two')).toEqual(['One', 'Two']);
	});

	it('does not duplicate an alias, ignoring case and whitespace', () => {
		expect(withAliasAdded(['R Package'], ' r package ')).toEqual(['R Package']);
	});

	it('promotes a bare-string aliases value to a list', () => {
		expect(withAliasAdded('One', 'Two')).toEqual(['One', 'Two']);
	});

	it('creates a list from an absent or malformed value', () => {
		expect(withAliasAdded(undefined, 'Two')).toEqual(['Two']);
		expect(withAliasAdded(42, 'Two')).toEqual(['Two']);
	});

	it('ignores a blank alias', () => {
		expect(withAliasAdded(['One'], '   ')).toEqual(['One']);
	});
});
