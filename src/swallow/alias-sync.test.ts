import { describe, expect, it } from 'vitest';
import { makeFakeApp } from '../test-support/fake-obsidian';
import { createSwallowAliasHandler } from './alias-sync';

function setup(
	notes: Record<string, Record<string, unknown>>,
	opts: { enabled?: boolean; ignored?: string[] } = {},
) {
	const fake = makeFakeApp(notes);
	const handler = createSwallowAliasHandler(fake.app, {
		isEnabled: () => opts.enabled ?? true,
		getIgnoredFolders: () => opts.ignored ?? [],
	});
	const run = (path: string) => handler(fake.app.vault.getAbstractFileByPath(path) as never);
	return { fake, run };
}

describe('createSwallowAliasHandler', () => {
	it('adds swallowed terms to the note\'s own aliases', () => {
		const { fake, run } = setup({ 'R.md': { swallows: ['R package', 'rlang'], aliases: ['rlang'] } });
		run('R.md');
			expect(fake.frontmatter.get('R.md')?.aliases).toEqual(['rlang', 'R package']);
	});

	it('creates aliases when the note has none', () => {
		const { fake, run } = setup({ 'R.md': { swallows: ['R package'] } });
		run('R.md');
			expect(fake.frontmatter.get('R.md')?.aliases).toEqual(['R package']);
	});

	it('writes nothing once every term is already an alias, so it cannot retrigger itself', () => {
		const { fake, run } = setup({ 'R.md': { swallows: ['R package'] } });
		run('R.md');
			run('R.md');
			expect(fake.writes).toEqual(['R.md']);
	});

	it('does nothing when the setting is off', () => {
		const { fake, run } = setup({ 'R.md': { swallows: ['R package'] } }, { enabled: false });
		run('R.md');
			expect(fake.writes).toEqual([]);
	});

	it('skips redirect stubs and disambiguation pages, whose claims are invalid', () => {
		const { fake, run } = setup({
			'Stub.md': { 'redirects-to': '[[R]]', swallows: ['x'] },
			'Disambig.md': { disambiguates: ['[[R]]'], swallows: ['y'] },
		});
		run('Stub.md');
		run('Disambig.md');
			expect(fake.writes).toEqual([]);
	});

	it('skips ignored folders and non-markdown files', () => {
		const { fake, run } = setup(
			{
				'Templates/T.md': { swallows: ['t'] },
				'data.json': { swallows: ['d'] },
			},
			{ ignored: ['Templates'] },
		);
		run('Templates/T.md');
		run('data.json');
			expect(fake.writes).toEqual([]);
	});
});
