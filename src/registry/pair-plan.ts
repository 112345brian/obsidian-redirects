/**
 * Plans the two-way redirect sync and the alias sync over a set of
 * stub/canonical pairs. Pure: it only describes the frontmatter changes
 * wanted; `pair-sync.ts` applies them.
 */

import { withAliasesAdded } from '../authoring/mutations';
import { formatWikilink } from '../contract/wikilink';
import { RedirectPair } from './redirect-pairs';
import { VaultNoteFile } from './types';

export interface PairSyncOptions {
	/** Copy a canonical note's `redirects-from` entry onto a stub that has no
	 * `redirects-to` of its own. */
	addRedirectsTo: boolean;
	/** Add each stub's name to its canonical note's `aliases`. */
	aliasStubOnCanonical: boolean;
	/** Add the canonical note's name to each stub's `aliases`. */
	aliasCanonicalOnStub: boolean;
	/** The configured `redirects-to` property name. */
	redirectToKey: string;
}

/** The frontmatter changes the sync wants to make to one note. */
export interface NotePatch {
	path: string;
	/** Wikilink text to write as the note's `redirects-to`. */
	setRedirectTo?: string;
	addAliases: string[];
}

function hasAlias(file: VaultNoteFile, alias: string): boolean {
	const key = alias.trim().toLowerCase();
	return file.aliases.some((a) => a.trim().toLowerCase() === key);
}

/** Works out what the sync would change; touches nothing. A note that is
 * already in the desired state produces no patch, which is what stops the
 * write → metadata change → resync cycle. */
export function planPairSync(pairs: RedirectPair[], options: PairSyncOptions): NotePatch[] {
	const patches = new Map<string, NotePatch>();
	const patchFor = (path: string): NotePatch => {
		const existing = patches.get(path);
		if (existing) return existing;
		const created: NotePatch = { path, addAliases: [] };
		patches.set(path, created);
		return created;
	};
	const addAlias = (target: VaultNoteFile, alias: string): void => {
		if (!alias.trim() || alias.trim().toLowerCase() === target.basename.toLowerCase()) return;
		if (hasAlias(target, alias)) return;
		const patch = patchFor(target.path);
		if (!patch.addAliases.some((a) => a.toLowerCase() === alias.trim().toLowerCase())) {
			patch.addAliases.push(alias.trim());
		}
	};

	for (const { stub, canonical, declaredByStub, declaredByCanonical } of pairs) {
		// A stub that already has a (even malformed) redirects-to is never
		// overwritten, and a note with real body content isn't a stub — turning
		// it into a redirect would make it unreachable by normal navigation.
		const stubValue = stub.frontmatter?.[options.redirectToKey];
		const stubHasNoTarget = stubValue === undefined || stubValue === null;
		if (
			options.addRedirectsTo &&
			declaredByCanonical &&
			!declaredByStub &&
			stubHasNoTarget &&
			!stub.hasBodyContent
		) {
			patchFor(stub.path).setRedirectTo = formatWikilink({
				path: canonical.path.replace(/\.md$/i, ''),
			});
		}

		if (options.aliasStubOnCanonical) addAlias(canonical, stub.basename);
		if (options.aliasCanonicalOnStub) addAlias(stub, canonical.basename);
	}

	return [...patches.values()].filter((p) => p.setRedirectTo !== undefined || p.addAliases.length > 0);
}

/** Applies a patch to a frontmatter object in place and reports what it
 * actually changed. An existing `redirects-to` is never overwritten. */
export function applyPatchToFrontmatter(
	fm: Record<string, unknown>,
	patch: NotePatch,
	redirectToKey: string,
): { redirectsAdded: number; aliasesAdded: number } {
	let redirectsAdded = 0;
	let aliasesAdded = 0;
	if (patch.setRedirectTo && (fm[redirectToKey] === undefined || fm[redirectToKey] === null)) {
		fm[redirectToKey] = patch.setRedirectTo;
		redirectsAdded = 1;
	}
	if (patch.addAliases.length > 0) {
		const before = withAliasesAdded(fm.aliases, []).length;
		const after = withAliasesAdded(fm.aliases, patch.addAliases);
		if (after.length !== before) {
			fm.aliases = after;
			aliasesAdded = after.length - before;
		}
	}
	return { redirectsAdded, aliasesAdded };
}
