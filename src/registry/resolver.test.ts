import { describe, expect, it } from 'vitest';
import { parseWikilink } from '../contract/wikilink';
import { VaultIndex, resolveTarget } from './resolver';
import { file } from './test-helpers';

describe('resolveTarget', () => {
	it('resolves an ordinary note by path', () => {
		const index = new VaultIndex([file({ path: 'Canonical note.md' })]);
		const result = resolveTarget(parseWikilink('[[Canonical note]]')!, index);
		expect(result.status).toBe('resolved');
		expect(result.file?.path).toBe('Canonical note.md');
	});

	it('resolves a note by basename when no path matches', () => {
		const index = new VaultIndex([file({ path: 'folder/Sub note.md' })]);
		const result = resolveTarget(parseWikilink('[[Sub note]]')!, index);
		expect(result.status).toBe('resolved');
		expect(result.file?.path).toBe('folder/Sub note.md');
	});

	it('resolves a note by alias', () => {
		const index = new VaultIndex([
			file({ path: 'Canonical note.md', aliases: ['CN', 'The note'] }),
		]);
		const result = resolveTarget(parseWikilink('[[CN]]')!, index);
		expect(result.status).toBe('resolved');
		expect(result.file?.path).toBe('Canonical note.md');
	});

	it('resolves an existing heading', () => {
		const index = new VaultIndex([
			file({ path: 'Note.md', headings: ['Intro', 'Details'] }),
		]);
		const result = resolveTarget(parseWikilink('[[Note#Details]]')!, index);
		expect(result.status).toBe('resolved');
	});

	it('flags a missing heading as unresolved-heading', () => {
		const index = new VaultIndex([file({ path: 'Note.md', headings: ['Intro'] })]);
		const result = resolveTarget(parseWikilink('[[Note#Missing]]')!, index);
		expect(result.status).toBe('unresolved-heading');
	});

	it('resolves an existing block id', () => {
		const index = new VaultIndex([file({ path: 'Note.md', blockIds: ['abc123'] })]);
		const result = resolveTarget(parseWikilink('[[Note#^abc123]]')!, index);
		expect(result.status).toBe('resolved');
	});

	it('flags a missing block id as unresolved-block', () => {
		const index = new VaultIndex([file({ path: 'Note.md', blockIds: [] })]);
		const result = resolveTarget(parseWikilink('[[Note#^missing]]')!, index);
		expect(result.status).toBe('unresolved-block');
	});

	it('flags a target with no matching note as unresolved-note', () => {
		const index = new VaultIndex([file({ path: 'Note.md' })]);
		const result = resolveTarget(parseWikilink('[[Nonexistent]]')!, index);
		expect(result.status).toBe('unresolved-note');
	});

	it('does not treat a note as ambiguous with itself when an alias matches its own basename', () => {
		const index = new VaultIndex([
			file({ path: 'folder/Note.md', aliases: ['Note'] }),
		]);
		const result = resolveTarget(parseWikilink('[[Note]]')!, index);
		expect(result.status).toBe('resolved');
		expect(result.file?.path).toBe('folder/Note.md');
	});

	it('flags duplicate titles as ambiguous-note', () => {
		const index = new VaultIndex([
			file({ path: 'a/Duplicate.md' }),
			file({ path: 'b/Duplicate.md' }),
		]);
		const result = resolveTarget(parseWikilink('[[Duplicate]]')!, index);
		expect(result.status).toBe('ambiguous-note');
		expect(result.candidates).toHaveLength(2);
	});

	it('prefers an exact path match over a basename collision', () => {
		const index = new VaultIndex([
			file({ path: 'a/Duplicate.md' }),
			file({ path: 'b/Duplicate.md' }),
		]);
		const result = resolveTarget(parseWikilink('[[b/Duplicate]]')!, index);
		expect(result.status).toBe('resolved');
		expect(result.file?.path).toBe('b/Duplicate.md');
	});
});
