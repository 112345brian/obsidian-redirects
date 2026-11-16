import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotices, notices } from '../test-support/obsidian-stub';
import { makeFakeApp } from '../test-support/fake-obsidian';
import { syncRedirectPairs } from './pair-sync';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

const ALL_ON = { addRedirectsTo: true, aliasStubOnCanonical: true, aliasCanonicalOnStub: true };

function registryFor(frontmatter: Map<string, Record<string, unknown>>) {
	return new RedirectRegistry(
		vaultOf(
			[...frontmatter].map(([path, fm]) =>
				file({
					path,
					frontmatter: fm,
					aliases: Array.isArray(fm.aliases) ? (fm.aliases as string[]) : [],
				}),
			),
		),
	);
}

beforeEach(() => {
	clearNotices();
});

describe('syncRedirectPairs', () => {
	it('adds redirects-to and aliases through processFrontMatter, with one summary notice', async () => {
		const fake = makeFakeApp({
			'Old.md': {},
			'New.md': { 'redirects-from': ['[[Old]]'] },
		});
		await syncRedirectPairs(fake.app, registryFor(fake.frontmatter), ALL_ON);

		expect(fake.frontmatter.get('Old.md')).toEqual({ 'redirects-to': '[[New]]', aliases: ['New'] });
		expect(fake.frontmatter.get('New.md')).toEqual({
			'redirects-from': ['[[Old]]'],
			aliases: ['Old'],
		});
		expect(notices).toEqual(['Redirects: added 1 missing redirect target and added 2 aliases.']);
	});

	it('does nothing at all when every option is off', async () => {
		const fake = makeFakeApp({
			'Old.md': {},
			'New.md': { 'redirects-from': ['[[Old]]'] },
		});
		await syncRedirectPairs(fake.app, registryFor(fake.frontmatter), {
			addRedirectsTo: false,
			aliasStubOnCanonical: false,
			aliasCanonicalOnStub: false,
		});
		expect(fake.writes).toEqual([]);
		expect(notices).toEqual([]);
	});

	it('is idempotent: a second pass over the updated vault writes nothing', async () => {
		const fake = makeFakeApp({
			'Old.md': {},
			'New.md': { 'redirects-from': ['[[Old]]'] },
		});
		await syncRedirectPairs(fake.app, registryFor(fake.frontmatter), ALL_ON);
		const writesAfterFirst = fake.writes.length;
		clearNotices();

		await syncRedirectPairs(fake.app, registryFor(fake.frontmatter), ALL_ON);
		expect(fake.writes.length).toBe(writesAfterFirst);
		expect(notices).toEqual([]);
	});

	it('skips a planned note that no longer exists in the vault', async () => {
		const fake = makeFakeApp({ 'New.md': { 'redirects-from': ['[[Old]]'] } });
		const registry = registryFor(
			new Map([
				['Old.md', {}],
				['New.md', { 'redirects-from': ['[[Old]]'] }],
			]),
		);
		await syncRedirectPairs(fake.app, registry, ALL_ON);
		expect(fake.writes).toEqual(['New.md']);
		expect(fake.frontmatter.get('New.md')?.aliases).toEqual(['Old']);
	});

	it('does not overwrite a redirects-to that appeared after the plan was made', async () => {
		const fake = makeFakeApp({
			'Old.md': { 'redirects-to': '[[Elsewhere]]' },
			'New.md': { 'redirects-from': ['[[Old]]'] },
		});
		// The registry's cache is stale: it still sees a bare stub.
		const stale = registryFor(
			new Map([
				['Old.md', {}],
				['New.md', { 'redirects-from': ['[[Old]]'] }],
			]),
		);
		await syncRedirectPairs(fake.app, stale, {
			addRedirectsTo: true,
			aliasStubOnCanonical: false,
			aliasCanonicalOnStub: false,
		});
		expect(fake.frontmatter.get('Old.md')).toEqual({ 'redirects-to': '[[Elsewhere]]' });
		expect(notices).toEqual([]);
	});
});
