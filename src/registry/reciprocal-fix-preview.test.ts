import { describe, expect, it } from 'vitest';
import { reciprocalFixPreview } from './reciprocal-fix-preview';

describe('reciprocalFixPreview', () => {
	it('previews adding a missing reciprocal', () => {
		expect(
			reciprocalFixPreview({
				type: 'missing-reciprocal',
				path: 'Canonical.md',
				message: 'irrelevant here',
				related: ['Stub.md'],
			}),
		).toEqual(['Add to "Canonical.md":', '  redirects_from: [..., "[[Stub]]"]']);
	});

	it('previews removing a stale reciprocal using the exact raw wikilink text', () => {
		expect(
			reciprocalFixPreview({
				type: 'stale-reciprocal',
				path: 'Canonical.md',
				message: 'irrelevant here',
				related: ['[[Old stub]]'],
			}),
		).toEqual(['Remove from "Canonical.md":', '  redirects_from: "[[Old stub]]"']);
	});
});
