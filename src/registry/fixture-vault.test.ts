/**
 * Fixture-vault regression coverage (issue #8): a single, more realistic
 * vault snapshot exercising several features together — aliases, a duplicate
 * title, heading/block targets, a redirect chain and a cycle, a broken
 * fragment, a promotion candidate, and a swallow claim — so a change to one
 * feature's logic can't silently break another's behavior in combination.
 */

import { describe, expect, it } from 'vitest';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

function buildFixtureVault() {
	return vaultOf([
		// A straightforward stub -> canonical redirect, correctly reciprocated.
		file({ path: 'Old name.md', frontmatter: { redirect_to: '[[Canonical]]' } }),
		file({
			path: 'Canonical.md',
			frontmatter: { redirects_from: ['[[Old name]]'] },
			aliases: ['Canon'],
			headings: ['Overview', 'Details'],
			blockIds: ['intro'],
		}),

		// A chain: Hop A -> Hop B -> Canonical (already targeted, so it's not
		// double-reported as its own chain).
		file({ path: 'Hop A.md', frontmatter: { redirect_to: '[[Hop B]]' } }),
		file({ path: 'Hop B.md', frontmatter: { redirect_to: '[[Canonical]]' } }),

		// A genuine two-note cycle.
		file({ path: 'Cycle A.md', frontmatter: { redirect_to: '[[Cycle B]]' } }),
		file({ path: 'Cycle B.md', frontmatter: { redirect_to: '[[Cycle A]]' } }),

		// A redirect stub with a broken heading fragment.
		file({ path: 'Broken fragment stub.md', frontmatter: { redirect_to: '[[Canonical#Nope]]' } }),

		// A promotion candidate: a stub that has grown real content.
		file({
			path: 'Grew content.md',
			frontmatter: { redirect_to: '[[Canonical]]' },
			hasBodyContent: true,
		}),

		// A duplicate title, forcing ambiguous resolution.
		file({ path: 'Math/Vector.md' }),
		file({ path: 'Physics/Vector.md' }),
		file({
			path: 'Vector.md',
			frontmatter: {
				disambiguates: ['[[Math/Vector]]', '[[Physics/Vector]]'],
			},
		}),

		// A canonical note claiming a term no other note has.
		file({ path: 'software-library.md', frontmatter: { swallows: ['R package'] } }),
	]);
}

describe('fixture vault', () => {
	it('resolves the straightforward stub via its exact path, heading, and block', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		expect(registry.getRedirect('Old name.md')?.resolved.file?.path).toBe('Canonical.md');
	});

	it('follows a multi-hop chain to its final target without double-reporting it', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		expect(registry.resolveFinalTarget('Hop A.md')?.file?.path).toBe('Canonical.md');

		const chains = registry.getHealthReport().filter((i) => i.type === 'redirect-chain');
		expect(chains).toHaveLength(1);
		expect(chains[0]?.related).toEqual(['Hop A.md', 'Hop B.md', 'Canonical.md']);
	});

	it('reports the cycle without following it anywhere', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		const cycles = registry.getHealthReport().filter((i) => i.type === 'redirect-cycle');
		expect(cycles).toHaveLength(1);
	});

	it('reports the broken heading fragment but still identifies the file', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		const entry = registry.getRedirect('Broken fragment stub.md');
		expect(entry?.resolved.status).toBe('unresolved-heading');
		expect(entry?.resolved.file?.path).toBe('Canonical.md');
		expect(registry.getHealthReport()).toContainEqual(
			expect.objectContaining({ type: 'broken-target', path: 'Broken fragment stub.md' }),
		);
	});

	it('flags a redirect stub that has grown real content as a promotion candidate', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		expect(registry.getHealthReport()).toContainEqual(
			expect.objectContaining({ type: 'promotion-candidate', path: 'Grew content.md' }),
		);
	});

	it('never picks a default among duplicate titles', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		const entry = registry.getDisambiguation('Vector.md');
		expect(entry?.candidates.map((c) => c.status)).toEqual(['resolved', 'resolved']);
		expect(entry?.candidates.map((c) => c.file?.path).sort()).toEqual([
			'Math/Vector.md',
			'Physics/Vector.md',
		]);
	});

	it('resolves an unambiguous swallow claim independently of the rest of the vault', () => {
		const registry = new RedirectRegistry(buildFixtureVault());
		expect(registry.getSwallowResolution('R package')).toEqual({
			status: 'unambiguous',
			canonicalPath: 'software-library.md',
		});
	});

	it('keeps every feature working after a simulated rename/move of the canonical note', () => {
		const before = buildFixtureVault();
		const registry = new RedirectRegistry(before);
		expect(registry.getRedirect('Old name.md')?.resolved.file?.path).toBe('Canonical.md');

		// Obsidian would rewrite every native-link property that pointed at
		// "Canonical" when the file moves; the registry never does this
		// itself, so the rebuild here mirrors what Obsidian's own renamer
		// would have already done to the frontmatter before `changed` fires.
		const after = vaultOf(
			before.getFiles().map((f) => {
				if (f.path === 'Canonical.md') return file({ ...f, path: 'Archive/Canonical.md' });
				const fm = f.frontmatter;
				if (!fm) return f;
				const rewritten = JSON.parse(
					JSON.stringify(fm).replaceAll('[[Canonical', '[[Archive/Canonical'),
				) as Record<string, unknown>;
				return file({ ...f, frontmatter: rewritten });
			}),
		);
		registry.rebuild(after);

		expect(registry.getRedirect('Old name.md')?.resolved.file?.path).toBe('Archive/Canonical.md');
		expect(registry.resolveFinalTarget('Hop A.md')?.file?.path).toBe('Archive/Canonical.md');
		expect(registry.getHealthReport().some((i) => i.type === 'broken-target' && i.path === 'Old name.md')).toBe(
			false,
		);
	});

	it('does not mutate any vault file across a full rebuild and every read', () => {
		const files = buildFixtureVault().getFiles();
		const snapshot = JSON.stringify(files);

		const registry = new RedirectRegistry(vaultOf(files));
		registry.getHealthReport();
		registry.resolveFinalTarget('Hop A.md');
		registry.getSwallowResolution('R package');
		registry.getDisambiguation('Vector.md');

		expect(JSON.stringify(files)).toBe(snapshot);
	});
});
