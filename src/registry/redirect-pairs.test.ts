import { describe, expect, it } from 'vitest';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

function pairsOf(files: ReturnType<typeof file>[]) {
	return new RedirectRegistry(vaultOf(files)).getRedirectPairs();
}

describe('RedirectRegistry.getRedirectPairs', () => {
	it('merges both declarations of the same pair', () => {
		const pairs = pairsOf([
			file({ path: 'Old.md', frontmatter: { 'redirects-to': '[[New]]' } }),
			file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
		]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]).toMatchObject({ declaredByStub: true, declaredByCanonical: true });
	});

	it('finds a pair declared only by the canonical note', () => {
		const pairs = pairsOf([
			file({ path: 'Old.md' }),
			file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
		]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]).toMatchObject({ declaredByStub: false, declaredByCanonical: true });
		expect(pairs[0]!.stub.path).toBe('Old.md');
	});

	it('drops a claim whose stub redirects somewhere else', () => {
		const pairs = pairsOf([
			file({ path: 'Old.md', frontmatter: { 'redirects-to': '[[Elsewhere]]' } }),
			file({ path: 'Elsewhere.md' }),
			file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
		]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]!.canonical.path).toBe('Elsewhere.md');
		expect(pairs[0]!.declaredByCanonical).toBe(false);
	});

	it('drops a stub claimed by several notes when it names no destination', () => {
		const pairs = pairsOf([
			file({ path: 'Old.md' }),
			file({ path: 'A.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			file({ path: 'B.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
		]);
		expect(pairs).toEqual([]);
	});

	it('ignores unresolved claims and self-references', () => {
		const pairs = pairsOf([
			file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Missing]]', '[[New]]'] } }),
		]);
		expect(pairs).toEqual([]);
	});
});
