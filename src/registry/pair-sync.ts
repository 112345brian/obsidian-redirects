/**
 * Applies the two-way redirect sync and the alias sync (see
 * `planPairSync`): a canonical note's `redirects-from` entry becomes the
 * stub's `redirects-to`, and each note's name is added as an alias on the
 * other. Every option is off by default and applied with no confirmation, in
 * the same spirit as `syncMissingReciprocals` — each change is a
 * deterministic consequence of a declaration the user already wrote.
 */

import { App, Notice, TFile } from 'obsidian';
import { redirectToKey } from '../contract/frontmatter';
import { PairSyncOptions, applyPatchToFrontmatter, planPairSync } from './pair-plan';
import { RedirectRegistry } from './registry';

export type PairSyncSettings = Omit<PairSyncOptions, 'redirectToKey'>;

export async function syncRedirectPairs(
	app: App,
	registry: RedirectRegistry,
	settings: PairSyncSettings,
): Promise<void> {
	if (!settings.addRedirectsTo && !settings.aliasStubOnCanonical && !settings.aliasCanonicalOnStub) {
		return;
	}

	const key = redirectToKey();
	const patches = planPairSync(registry.getRedirectPairs(), { ...settings, redirectToKey: key });

	let redirectsAdded = 0;
	let aliasesAdded = 0;
	for (const patch of patches) {
		const file = app.vault.getAbstractFileByPath(patch.path);
		if (!(file instanceof TFile)) continue;
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			// Re-checked inside the write: the plan came from the cache, which
			// may be a moment behind the file.
			const applied = applyPatchToFrontmatter(fm, patch, key);
			redirectsAdded += applied.redirectsAdded;
			aliasesAdded += applied.aliasesAdded;
		});
	}

	const parts: string[] = [];
	if (redirectsAdded > 0) {
		parts.push(`added ${redirectsAdded} missing redirect target${redirectsAdded === 1 ? '' : 's'}`);
	}
	if (aliasesAdded > 0) parts.push(`added ${aliasesAdded} alias${aliasesAdded === 1 ? '' : 'es'}`);
	if (parts.length > 0) new Notice(`Redirects: ${parts.join(' and ')}.`);
}
