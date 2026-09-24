import { describe, expect, it } from 'vitest';
import {
	normalizeWikilinkList,
	stubFrontmatterText,
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
	it('renders a redirect_to frontmatter block', () => {
		expect(stubFrontmatterText('redirect_to', { path: 'Canonical', raw: '[[Canonical]]' })).toBe(
			'---\nredirect_to: "[[Canonical]]"\n---\n',
		);
	});
});
