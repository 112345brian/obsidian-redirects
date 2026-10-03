/**
 * Pure tracking for "backing into a redirect stub" (no Obsidian dependency).
 *
 * Obsidian fires `file-open` for history navigation exactly as it does for a
 * fresh open, so a back-step from a redirect's target onto its stub would be
 * followed again and trap the user on the target. The tracker remembers where
 * each stub last redirected to and which file was open just before the current
 * one; arriving at a stub straight from its own target is a return, not a fresh
 * navigation, so the stub stays open and editable.
 */
export class RedirectReturnTracker {
	private previousPath: string | undefined;
	private targetByStub = new Map<string, string>();

	/** Records that `stubPath` was redirected to `targetPath`. */
	recordRedirect(stubPath: string, targetPath: string): void {
		this.targetByStub.set(stubPath, targetPath);
	}

	/**
	 * Registers that `path` was just opened. Returns true when it is a stub being
	 * returned to from the target it last redirected to. Call once per open.
	 */
	opened(path: string): boolean {
		const target = this.targetByStub.get(path);
		const isReturn = target !== undefined && target === this.previousPath;
		this.previousPath = path;
		return isReturn;
	}

	/** Follows a rename so recorded stubs, targets and the previous file stay valid. */
	renamed(oldPath: string, newPath: string): void {
		if (this.previousPath === oldPath) this.previousPath = newPath;
		const next = new Map<string, string>();
		for (const [stub, target] of this.targetByStub) {
			next.set(stub === oldPath ? newPath : stub, target === oldPath ? newPath : target);
		}
		this.targetByStub = next;
	}

	/** Forgets a deleted file, whether it was a stub, a target or the previous file. */
	deleted(path: string): void {
		if (this.previousPath === path) this.previousPath = undefined;
		for (const [stub, target] of this.targetByStub) {
			if (stub === path || target === path) this.targetByStub.delete(stub);
		}
	}
}
