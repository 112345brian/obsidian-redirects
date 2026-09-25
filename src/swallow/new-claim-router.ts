/**
 * Wires the "just declared a new swallow claim" flow (issue #10) into the
 * real Obsidian app: on `metadataCache`'s `changed` event, diffs a file's
 * current `swallows` list against what was there the last time this ran,
 * and for a genuinely new, unambiguous, non-conflicting term, previews
 * every existing bare occurrence vault-wide and asks for confirmation
 * before qualifying any of them — a link typed after this point against the
 * now-established claim is still fixed silently by `router.ts`; only the
 * retroactive, potentially-many-files effect of the claim itself needs an
 * explicit yes.
 */

import { App, Notice, TFile } from 'obsidian';
import { parseContract } from '../contract/frontmatter';
import { RedirectRegistry } from '../registry/registry';
import { confirmMutation } from '../ui/confirm-modal';
import { computeNewlyAddedTerms, findBareOccurrences } from './new-claim';
import { qualifyBareLinksInContent } from './qualify-content';
import { SwallowRouterOptions } from './router';

export type NewClaimRouterOptions = SwallowRouterOptions;

function newClaimDismissalKey(term: string): string {
	return `new-claim::${term}`;
}

function currentValidTerms(app: App, file: TFile): string[] {
	const cache = app.metadataCache.getFileCache(file);
	const contract = parseContract(cache?.frontmatter);
	const isValidClaimant = !contract.redirectTo && contract.disambiguates.length === 0;
	return isValidClaimant ? contract.swallows : [];
}

export function createNewClaimHandler(app: App, options: NewClaimRouterOptions) {
	const seenTerms = new Map<string, Set<string>>();

	// Seed from the vault's current state so every claim that already
	// existed when the plugin loaded is a known baseline, not a "new" one —
	// otherwise the first save of any pre-existing swallows-declaring note
	// would look like a brand-new claim and prompt spuriously.
	for (const file of app.vault.getMarkdownFiles()) {
		seenTerms.set(file.path, new Set(currentValidTerms(app, file)));
	}

	return (file: TFile): void => {
		if (file.extension !== 'md') return;
		if (isIgnored(file.path, options.getIgnoredFolders())) return;

		const current = currentValidTerms(app, file);
		const newTerms = computeNewlyAddedTerms(seenTerms.get(file.path), current);
		seenTerms.set(file.path, new Set(current));
		if (newTerms.length === 0) return;

		const registry = options.getRegistry();
		if (!registry) return;

		for (const term of newTerms) {
			void handleNewClaim(app, registry, file, term, options);
		}
	};
}

async function handleNewClaim(
	app: App,
	registry: RedirectRegistry,
	claimFile: TFile,
	term: string,
	options: NewClaimRouterOptions,
): Promise<void> {
	// Only the clean, unambiguous, non-conflicting case gets a retroactive
	// bulk offer — an ambiguous or alias-conflicting claim has no single
	// safe rewrite to preview yet, and stays visible in the health report.
	const resolution = registry.getSwallowResolution(term);
	if (resolution.status !== 'unambiguous' || resolution.canonicalPath !== claimFile.path) return;
	if (resolution.aliasConflictPaths && resolution.aliasConflictPaths.length > 0) return;

	const dismissKey = newClaimDismissalKey(term);
	if (options.getDismissedPrompts().includes(dismissKey)) return;

	const affected = findBareOccurrences(app.metadataCache.unresolvedLinks, term);
	if (affected.length === 0) return;

	const totalCount = affected.reduce((sum, a) => sum + a.count, 0);
	const preview = [
		`Qualify ${totalCount} existing link${totalCount === 1 ? '' : 's'} matching "${term}" to`,
		`"[[${claimFile.basename}|${term}]]":`,
		'',
		...affected.map((a) => `  ${a.path} (${a.count})`),
	];

	const confirmed = await confirmMutation(app, `New swallow claim: "${term}"`, preview);
	if (!confirmed) {
		await options.saveDismissedPrompt(dismissKey);
		return;
	}

	let fixedCount = 0;
	for (const { path } of affected) {
		const target = app.vault.getAbstractFileByPath(path);
		if (!(target instanceof TFile)) continue;
		const content = await app.vault.read(target);
		const { content: updated, count } = qualifyBareLinksInContent(content, term, claimFile.basename);
		if (count > 0) {
			await app.vault.modify(target, updated);
			fixedCount += count;
		}
	}
	new Notice(`Redirects: qualified ${fixedCount} existing link${fixedCount === 1 ? '' : 's'} to match the new "${term}" swallow claim.`);
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
	return ignoredFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
}
