import { describe, expect, it } from 'vitest';
import { RedirectReturnTracker } from './return-tracker';

describe('RedirectReturnTracker', () => {
	it('treats a fresh open of a stub as not a return', () => {
		const tracker = new RedirectReturnTracker();
		expect(tracker.opened('Stub.md')).toBe(false);
	});

	it('treats stepping from the target back onto its stub as a return', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		expect(tracker.opened('Stub.md')).toBe(true);
	});

	it('keeps treating repeated back/forward steps as returns', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		expect(tracker.opened('Stub.md')).toBe(true);
		tracker.opened('Canonical.md');
		expect(tracker.opened('Stub.md')).toBe(true);
	});

	it('redirects again when the stub is reached from somewhere else', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		tracker.opened('Other.md');
		expect(tracker.opened('Stub.md')).toBe(false);
	});

	it('only treats a stub as returned-to from its own target', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('A.md');
		tracker.recordRedirect('A.md', 'C.md');
		tracker.opened('C.md');
		tracker.opened('B.md');
		expect(tracker.opened('A.md')).toBe(false);
	});

	it('still recognises a return after the target is renamed', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		tracker.renamed('Canonical.md', 'Renamed.md');
		expect(tracker.opened('Stub.md')).toBe(true);
	});

	it('still recognises a return after the stub is renamed', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		tracker.renamed('Stub.md', 'Moved.md');
		expect(tracker.opened('Moved.md')).toBe(true);
	});

	it('does not treat an open as a return after the target is deleted', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		tracker.deleted('Canonical.md');
		expect(tracker.opened('Stub.md')).toBe(false);
	});

	it('forgets a deleted stub', () => {
		const tracker = new RedirectReturnTracker();
		tracker.opened('Stub.md');
		tracker.recordRedirect('Stub.md', 'Canonical.md');
		tracker.opened('Canonical.md');
		tracker.deleted('Stub.md');
		expect(tracker.opened('Stub.md')).toBe(false);
	});
});
