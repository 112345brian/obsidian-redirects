import { describe, expect, it } from 'vitest';
import { RedirectRegistry } from '../registry/registry';
import { file, vaultOf } from '../registry/test-helpers';
import { planNavigation } from './plan';

describe('planNavigation', () => {
	it('reports not-a-redirect for a plain note', () => {
		const registry = new RedirectRegistry(vaultOf([file({ path: 'Note.md' })]));
		expect(planNavigation(registry, 'Note.md')).toEqual({ kind: 'not-a-redirect' });
	});

	it('navigates a single-hop redirect to its target', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Canonical]]' } }),
				file({ path: 'Canonical.md', frontmatter: { redirects_from: ['[[Stub]]'] } }),
			]),
		);
		const outcome = planNavigation(registry, 'Stub.md');
		expect(outcome.kind).toBe('navigate');
		if (outcome.kind === 'navigate') {
			expect(outcome.target.file?.path).toBe('Canonical.md');
			expect(outcome.chain).toEqual(['Stub.md']);
		}
	});

	it('follows a multi-hop chain to its final target', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[B]]' } }),
				file({ path: 'B.md', frontmatter: { redirect_to: '[[C]]' } }),
				file({ path: 'C.md' }),
			]),
		);
		const outcome = planNavigation(registry, 'A.md');
		expect(outcome.kind).toBe('navigate');
		if (outcome.kind === 'navigate') {
			expect(outcome.target.file?.path).toBe('C.md');
			expect(outcome.chain).toEqual(['A.md', 'B.md']);
		}
	});

	it('detects a cycle instead of navigating anywhere', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[B]]' } }),
				file({ path: 'B.md', frontmatter: { redirect_to: '[[A]]' } }),
			]),
		);
		const outcome = planNavigation(registry, 'A.md');
		expect(outcome.kind).toBe('cycle');
		if (outcome.kind === 'cycle') {
			expect(outcome.chain).toEqual(['A.md', 'B.md', 'A.md']);
		}
	});

	it('reports broken when the target does not resolve', () => {
		const registry = new RedirectRegistry(
			vaultOf([file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Nowhere]]' } })]),
		);
		const outcome = planNavigation(registry, 'Stub.md');
		expect(outcome.kind).toBe('broken');
		if (outcome.kind === 'broken') {
			expect(outcome.final.status).toBe('unresolved-note');
		}
	});

	it('reports broken when a mid-chain hop is ambiguous', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[Term]]' } }),
				file({ path: 'x/Term.md' }),
				file({ path: 'y/Term.md' }),
			]),
		);
		const outcome = planNavigation(registry, 'A.md');
		expect(outcome.kind).toBe('broken');
		if (outcome.kind === 'broken') {
			expect(outcome.final.status).toBe('ambiguous-note');
		}
	});
});
