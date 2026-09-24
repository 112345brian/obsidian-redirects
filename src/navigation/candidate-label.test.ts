import { describe, expect, it } from 'vitest';
import { file } from '../registry/test-helpers';
import { describeCandidate } from './candidate-label';

describe('describeCandidate', () => {
	it('shows the resolved path', () => {
		const target = file({ path: 'Physics/Vector.md' });
		expect(
			describeCandidate({
				status: 'resolved',
				target: { path: 'Physics/Vector', raw: '[[Physics/Vector]]' },
				file: target,
			}),
		).toBe('Physics/Vector.md');
	});

	it('includes the heading fragment', () => {
		const target = file({ path: 'Math.md' });
		expect(
			describeCandidate({
				status: 'resolved',
				target: { path: 'Math', heading: 'Vector', raw: '[[Math#Vector]]' },
				file: target,
			}),
		).toBe('Math.md > Vector');
	});

	it('includes the block fragment', () => {
		const target = file({ path: 'Math.md' });
		expect(
			describeCandidate({
				status: 'resolved',
				target: { path: 'Math', blockId: 'abc123', raw: '[[Math#^abc123]]' },
				file: target,
			}),
		).toBe('Math.md > ^abc123');
	});

	it('flags an unresolved candidate', () => {
		expect(
			describeCandidate({
				status: 'unresolved-note',
				target: { path: 'Nowhere', raw: '[[Nowhere]]' },
			}),
		).toBe('Nowhere — unresolved-note');
	});
});
