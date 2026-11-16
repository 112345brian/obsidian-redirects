import { describe, expect, it } from 'vitest';
import { DEFAULT_PLUGIN_DATA } from '../data/plugin-data';
import { makeFakeApp } from '../test-support/fake-obsidian';

import { runAutoSync } from './auto-sync';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

function scenario(autoSyncReciprocals: boolean, extra: Partial<typeof DEFAULT_PLUGIN_DATA> = {}) {
	const notes = { 'Old.md': { 'redirects-to': '[[New]]' }, 'New.md': {} as Record<string, unknown> };
	const fake = makeFakeApp(notes);
	const registry = new RedirectRegistry(
		vaultOf(Object.entries(notes).map(([path, frontmatter]) => file({ path, frontmatter }))),
	);
	return {
		fake,
		run: () => runAutoSync(fake.app, registry, { ...DEFAULT_PLUGIN_DATA, autoSyncReciprocals, ...extra }),
	};
}

describe('runAutoSync', () => {
	it('adds the missing reciprocal entry when auto-sync is on', async () => {
		const { fake, run } = scenario(true);
		await run();
		expect(fake.frontmatter.get('New.md')?.['redirects-from']).toEqual(['[[Old]]']);
	});

	it('leaves the reciprocal alone when auto-sync is off', async () => {
		const { fake, run } = scenario(false);
		await run();
		expect(fake.writes).toEqual([]);
	});

	it('also runs the alias sync after the reciprocal sync', async () => {
		const { fake, run } = scenario(true, { aliasStubOnCanonical: true });
		await run();
		expect(fake.frontmatter.get('New.md')).toEqual({ 'redirects-from': ['[[Old]]'], aliases: ['Old'] });
	});
});
