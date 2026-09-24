import { describe, expect, it } from 'vitest';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

describe('RedirectRegistry', () => {
	it('resolves a stub to its canonical note', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Old name.md', frontmatter: { redirect_to: '[[Canonical]]' } }),
				file({
					path: 'Canonical.md',
					frontmatter: { redirects_from: ['[[Old name]]'] },
				}),
			]),
		);

		const entry = registry.getRedirect('Old name.md');
		expect(entry?.resolved.status).toBe('resolved');
		expect(entry?.resolved.file?.path).toBe('Canonical.md');
		expect(registry.getHealthReport()).toEqual([]);
	});

	it('reports a broken target when redirect_to does not resolve', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Nowhere]]' } }),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues).toEqual([
			expect.objectContaining({ type: 'broken-target', path: 'Stub.md' }),
		]);
	});

	it('reports a missing reciprocal declaration', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Canonical]]' } }),
				file({ path: 'Canonical.md' }),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues).toEqual([
			expect.objectContaining({ type: 'missing-reciprocal', path: 'Canonical.md' }),
		]);
	});

	it('reports a stale reciprocal declaration', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({
					path: 'Canonical.md',
					frontmatter: { redirects_from: ['[[Never existed]]'] },
				}),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues).toEqual([
			expect.objectContaining({ type: 'stale-reciprocal', path: 'Canonical.md' }),
		]);
	});

	it('reports a stale reciprocal when the stub points elsewhere', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Other]]' } }),
				file({ path: 'Other.md' }),
				file({
					path: 'Canonical.md',
					frontmatter: { redirects_from: ['[[Stub]]'] },
				}),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues.map((i) => i.type)).toContain('stale-reciprocal');
	});

	it('reports duplicate claims when two notes both claim the same stub', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md' }),
				file({ path: 'A.md', frontmatter: { redirects_from: ['[[Stub]]'] } }),
				file({ path: 'B.md', frontmatter: { redirects_from: ['[[Stub]]'] } }),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues.some((i) => i.type === 'duplicate-claim')).toBe(true);
	});

	it('detects a redirect cycle', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[B]]' } }),
				file({ path: 'B.md', frontmatter: { redirect_to: '[[A]]' } }),
			]),
		);
		const issues = registry.getHealthReport();
		const cycle = issues.find((i) => i.type === 'redirect-cycle');
		expect(cycle).toBeDefined();
		expect(cycle?.related).toContain('A.md');
		expect(cycle?.related).toContain('B.md');
	});

	it('detects a multi-hop redirect chain and resolves through it', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[B]]' } }),
				file({ path: 'B.md', frontmatter: { redirect_to: '[[C]]' } }),
				file({ path: 'C.md' }),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues.some((i) => i.type === 'redirect-chain')).toBe(true);
		const final = registry.resolveFinalTarget('A.md');
		expect(final?.file?.path).toBe('C.md');
	});

	it('reports a redirect chain exactly once, not once per hop', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { redirect_to: '[[B]]' } }),
				file({ path: 'B.md', frontmatter: { redirect_to: '[[C]]' } }),
				file({ path: 'C.md', frontmatter: { redirect_to: '[[D]]' } }),
				file({ path: 'D.md' }),
			]),
		);
		const chains = registry.getHealthReport().filter((i) => i.type === 'redirect-chain');
		expect(chains).toHaveLength(1);
		expect(chains[0]?.related).toEqual(['A.md', 'B.md', 'C.md', 'D.md']);
	});

	it('matches a reciprocal claim against a stub whose own redirect_to heading is broken', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Canonical#Missing]]' } }),
				file({
					path: 'Canonical.md',
					frontmatter: { redirects_from: ['[[Stub]]'] },
					headings: ['Present'],
				}),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues.some((i) => i.type === 'stale-reciprocal')).toBe(false);
		expect(issues.some((i) => i.type === 'missing-reciprocal')).toBe(false);
	});

	it('flags a redirect stub with body content as a promotion candidate', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({
					path: 'Stub.md',
					frontmatter: { redirect_to: '[[Canonical]]' },
					hasBodyContent: true,
				}),
				file({
					path: 'Canonical.md',
					frontmatter: { redirects_from: ['[[Stub]]'] },
				}),
			]),
		);
		const issues = registry.getHealthReport();
		expect(issues.some((i) => i.type === 'promotion-candidate')).toBe(true);
	});

	it('resolves a disambiguation page listing multiple candidates', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({
					path: 'Term.md',
					frontmatter: { disambiguates: ['[[Term (sense A)]]', '[[Term (sense B)]]'] },
				}),
				file({ path: 'Term (sense A).md' }),
				file({ path: 'Term (sense B).md' }),
			]),
		);
		const entry = registry.getDisambiguation('Term.md');
		expect(entry?.candidates).toHaveLength(2);
		expect(entry?.candidates.every((c) => c.status === 'resolved')).toBe(true);
		expect(registry.getHealthReport()).toEqual([]);
	});

	it('re-resolves correctly after a note is renamed and links updated', () => {
		const before = vaultOf([
			file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Old canonical]]' } }),
			file({
				path: 'Old canonical.md',
				frontmatter: { redirects_from: ['[[Stub]]'] },
			}),
		]);
		const registry = new RedirectRegistry(before);
		expect(registry.getRedirect('Stub.md')?.resolved.status).toBe('resolved');

		// Simulate Obsidian renaming "Old canonical.md" -> "New canonical.md"
		// and rewriting the wikilinks that pointed at it.
		const after = vaultOf([
			file({ path: 'Stub.md', frontmatter: { redirect_to: '[[New canonical]]' } }),
			file({
				path: 'New canonical.md',
				frontmatter: { redirects_from: ['[[Stub]]'] },
			}),
		]);
		registry.rebuild(after);

		const entry = registry.getRedirect('Stub.md');
		expect(entry?.resolved.status).toBe('resolved');
		expect(entry?.resolved.file?.path).toBe('New canonical.md');
		expect(registry.getHealthReport()).toEqual([]);
	});

	it('resolves an unambiguous swallow claim', () => {
		const registry = new RedirectRegistry(
			vaultOf([file({ path: 'software-library.md', frontmatter: { swallows: ['R package'] } })]),
		);
		expect(registry.getSwallowResolution('R package')).toEqual({
			status: 'unambiguous',
			canonicalPath: 'software-library.md',
		});
		expect(registry.getHealthReport()).toEqual([]);
	});

	it('reports a duplicate swallow claim as ambiguous and unresolvable', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'B.md', frontmatter: { swallows: ['R package'] } }),
			]),
		);
		expect(registry.getSwallowResolution('R package')).toEqual({
			status: 'ambiguous',
			candidatePaths: ['A.md', 'B.md'],
		});
		expect(registry.getHealthReport()).toEqual([
			expect.objectContaining({ type: 'duplicate-swallow-claim' }),
		]);
	});

	it('flags a redirect stub or disambiguation page claiming a term as invalid', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({
					path: 'Stub.md',
					frontmatter: { redirect_to: '[[Canonical]]', swallows: ['R package'] },
				}),
				file({ path: 'Canonical.md' }),
			]),
		);
		expect(registry.getSwallowResolution('R package')).toEqual({ status: 'none' });
		expect(registry.getHealthReport()).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: 'invalid-swallow-claimant' })]),
		);
	});

	it('never lets a swallow claim override an existing note with the exact same name', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'Library.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'R package.md' }),
			]),
		);
		expect(registry.getSwallowResolution('R package')).toEqual({
			status: 'collides-with-note',
			canonicalPath: 'R package.md',
		});
		expect(registry.getHealthReport()).toEqual([
			expect.objectContaining({ type: 'stale-swallow-claim', path: 'Library.md' }),
		]);
	});

	it('reports no swallow resolution for an unclaimed term', () => {
		const registry = new RedirectRegistry(vaultOf([file({ path: 'A.md' })]));
		expect(registry.getSwallowResolution('Nothing claims this')).toEqual({ status: 'none' });
	});

	it('surfaces an unambiguous claim that conflicts with an unrelated alias', () => {
		const registry = new RedirectRegistry(
			vaultOf([
				file({ path: 'software-library.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'Old library.md', aliases: ['R package'] }),
			]),
		);
		expect(registry.getSwallowResolution('R package')).toEqual({
			status: 'unambiguous',
			canonicalPath: 'software-library.md',
			aliasConflictPaths: ['Old library.md'],
		});
		expect(registry.getHealthReport()).toEqual([
			expect.objectContaining({
				type: 'swallow-alias-conflict',
				path: 'software-library.md',
				related: ['Old library.md'],
			}),
		]);
	});

	it('does not report an alias conflict for an ambiguous or colliding claim', () => {
		const ambiguous = new RedirectRegistry(
			vaultOf([
				file({ path: 'A.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'B.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'Old library.md', aliases: ['R package'] }),
			]),
		);
		expect(ambiguous.getHealthReport().map((i) => i.type)).not.toContain('swallow-alias-conflict');

		const colliding = new RedirectRegistry(
			vaultOf([
				file({ path: 'Library.md', frontmatter: { swallows: ['R package'] } }),
				file({ path: 'R package.md' }),
				file({ path: 'Old library.md', aliases: ['R package'] }),
			]),
		);
		expect(colliding.getHealthReport().map((i) => i.type)).not.toContain('swallow-alias-conflict');
	});

	it('does not mutate any vault file while building or validating', () => {
		const stub = file({ path: 'Stub.md', frontmatter: { redirect_to: '[[Canonical]]' } });
		const canonical = file({ path: 'Canonical.md' });
		const snapshot = JSON.stringify([stub, canonical]);

		const registry = new RedirectRegistry(vaultOf([stub, canonical]));
		registry.getHealthReport();
		registry.resolveFinalTarget('Stub.md');

		expect(JSON.stringify([stub, canonical])).toBe(snapshot);
	});
});
