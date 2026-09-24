import { describe, expect, it } from 'vitest';
import { file } from '../registry/test-helpers';
import { collisionKey, computeHeadingCollisions } from './scan';

describe('computeHeadingCollisions', () => {
	it('detects a heading matching an existing note title', () => {
		const files = [
			file({ path: 'Notes/A.md', headings: ['Partial pooling'] }),
			file({ path: 'Partial pooling.md' }),
		];
		const result = computeHeadingCollisions(files, new Set());
		expect(result).toEqual([
			{ sourcePath: 'Notes/A.md', heading: 'Partial pooling', candidatePaths: ['Partial pooling.md'] },
		]);
	});

	it('is case-insensitive and trims whitespace', () => {
		const files = [
			file({ path: 'A.md', headings: [' partial POOLING '] }),
			file({ path: 'Partial pooling.md' }),
		];
		expect(computeHeadingCollisions(files, new Set())).toHaveLength(1);
	});

	it('matches an alias, not just the basename', () => {
		const files = [
			file({ path: 'A.md', headings: ['Vector'] }),
			file({ path: 'Physics.md', aliases: ['Vector'] }),
		];
		const result = computeHeadingCollisions(files, new Set());
		expect(result[0]?.candidatePaths).toEqual(['Physics.md']);
	});

	it('does not collide a heading with its own note', () => {
		const files = [file({ path: 'Vector.md', headings: ['Vector'] })];
		expect(computeHeadingCollisions(files, new Set())).toEqual([]);
	});

	it('reports every ambiguous candidate', () => {
		const files = [
			file({ path: 'A.md', headings: ['Vector'] }),
			file({ path: 'Math/Vector.md' }),
			file({ path: 'Physics/Vector.md' }),
		];
		const result = computeHeadingCollisions(files, new Set());
		expect(result[0]?.candidatePaths.sort()).toEqual(['Math/Vector.md', 'Physics/Vector.md']);
	});

	it('excludes an already-handled heading', () => {
		const files = [
			file({ path: 'A.md', headings: ['Vector'] }),
			file({ path: 'Vector.md' }),
		];
		const handled = new Set([collisionKey('A.md', 'Vector')]);
		expect(computeHeadingCollisions(files, handled)).toEqual([]);
	});

	it('finds no collision for a heading with no matching note', () => {
		const files = [file({ path: 'A.md', headings: ['Unrelated heading'] })];
		expect(computeHeadingCollisions(files, new Set())).toEqual([]);
	});
});
