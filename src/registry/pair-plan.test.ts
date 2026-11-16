import { describe, expect, it } from 'vitest';
import { PairSyncOptions, applyPatchToFrontmatter, planPairSync } from './pair-plan';
import { RedirectRegistry } from './registry';
import { file, vaultOf } from './test-helpers';

const ALL_ON: PairSyncOptions = {
	addRedirectsTo: true,
	aliasStubOnCanonical: true,
	aliasCanonicalOnStub: true,
	redirectToKey: 'redirects-to',
};

function pairsOf(files: ReturnType<typeof file>[]) {
	return new RedirectRegistry(vaultOf(files)).getRedirectPairs();
}

describe('planPairSync', () => {
	it('adds redirects-to to a bare stub claimed by a canonical note', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md' }),
				file({ path: 'Notes/New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			]),
			{ ...ALL_ON, aliasStubOnCanonical: false, aliasCanonicalOnStub: false },
		);
		expect(patches).toEqual([{ path: 'Old.md', setRedirectTo: '[[Notes/New]]', addAliases: [] }]);
	});

	it('never overwrites a stub that already has a redirects-to, even a malformed one', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md', frontmatter: { 'redirects-to': 'not a link' } }),
				file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			]),
			{ ...ALL_ON, aliasStubOnCanonical: false, aliasCanonicalOnStub: false },
		);
		expect(patches).toEqual([]);
	});

	it('leaves a note with body content alone', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md', hasBodyContent: true }),
				file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			]),
			{ ...ALL_ON, aliasStubOnCanonical: false, aliasCanonicalOnStub: false },
		);
		expect(patches).toEqual([]);
	});

	it('adds each name as an alias on the other note', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md', frontmatter: { 'redirects-to': '[[New]]' } }),
				file({ path: 'New.md' }),
			]),
			ALL_ON,
		);
		expect(patches).toEqual(
			expect.arrayContaining([
				{ path: 'New.md', addAliases: ['Old'] },
				{ path: 'Old.md', addAliases: ['New'] },
			]),
		);
	});

	it('is a no-op once aliases exist (case-insensitively), so a write cannot retrigger itself', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md', aliases: ['new'], frontmatter: { 'redirects-to': '[[New]]' } }),
				file({ path: 'New.md', aliases: ['OLD'], frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			]),
			ALL_ON,
		);
		expect(patches).toEqual([]);
	});

	it('collects several stubs into one patch for their shared canonical note', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'A.md', frontmatter: { 'redirects-to': '[[Main]]' } }),
				file({ path: 'B.md', frontmatter: { 'redirects-to': '[[Main]]' } }),
				file({ path: 'Main.md' }),
			]),
			{ ...ALL_ON, aliasCanonicalOnStub: false },
		);
		expect(patches).toEqual([{ path: 'Main.md', addAliases: ['A', 'B'] }]);
	});

	it('does nothing when every option is off', () => {
		const patches = planPairSync(
			pairsOf([
				file({ path: 'Old.md' }),
				file({ path: 'New.md', frontmatter: { 'redirects-from': ['[[Old]]'] } }),
			]),
			{ ...ALL_ON, addRedirectsTo: false, aliasStubOnCanonical: false, aliasCanonicalOnStub: false },
		);
		expect(patches).toEqual([]);
	});
});

describe('applyPatchToFrontmatter', () => {
	it('sets redirects-to and adds aliases, reporting the counts', () => {
		const fm: Record<string, unknown> = { aliases: ['One'] };
		const result = applyPatchToFrontmatter(fm, { path: 'a.md', setRedirectTo: '[[B]]', addAliases: ['Two', 'one'] }, 'redirects-to');
		expect(fm).toEqual({ aliases: ['One', 'Two'], 'redirects-to': '[[B]]' });
		expect(result).toEqual({ redirectsAdded: 1, aliasesAdded: 1 });
	});

	it('never overwrites an existing redirects-to', () => {
		const fm: Record<string, unknown> = { 'redirects-to': '[[Keep]]' };
		const result = applyPatchToFrontmatter(fm, { path: 'a.md', setRedirectTo: '[[B]]', addAliases: [] }, 'redirects-to');
		expect(fm['redirects-to']).toBe('[[Keep]]');
		expect(result).toEqual({ redirectsAdded: 0, aliasesAdded: 0 });
	});

	it('leaves frontmatter untouched when nothing is missing', () => {
		const fm: Record<string, unknown> = { aliases: 'Two' };
		const result = applyPatchToFrontmatter(fm, { path: 'a.md', addAliases: ['two'] }, 'redirects-to');
		expect(fm).toEqual({ aliases: 'Two' });
		expect(result.aliasesAdded).toBe(0);
	});
});
