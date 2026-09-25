/**
 * Wires the swallow-claim fix (issue #10) into the real Obsidian app as a
 * linter-style "fix on save": whenever a note's metadata is reparsed
 * (`metadataCache`'s `changed` event, which fires after every save), its
 * unresolved links are checked against swallow claims — the same
 * `unresolvedLinks` cache issue #6 already reads, so no extra scanning.
 *
 * Declaring a `swallows` claim is itself the explicit authorization; an
 * unambiguous, non-conflicting match has no judgment call left to make, so
 * it's qualified immediately with a one-line summary Notice — the same
 * contract a linter's autofix uses. A genuine judgment call is never
 * resolved automatically: a duplicate claim still shows an explicit
 * chooser, and a claim that conflicts with an existing alias still shows
 * the consolidate/proceed/cancel dialog. A claim colliding with a real
 * note's exact filename is never applied at all.
 */

import { App, Notice, TFile } from 'obsidian';
import { RedirectRegistry, SwallowResolution } from '../registry/registry';
import { pickFromList } from '../ui/string-picker-modal';
import { promptAliasConflict } from './alias-conflict-modal';
import { withAliasRemoved } from './consolidate';
import { qualifyBareLinksInContent } from './qualify-content';

export interface SwallowRouterOptions {
	getRegistry: () => RedirectRegistry | undefined;
	getIgnoredFolders: () => string[];
}

export function createSwallowChangeHandler(app: App, options: SwallowRouterOptions) {
	return (file: TFile): void => {
		if (file.extension !== 'md') return;
		if (isIgnored(file.path, options.getIgnoredFolders())) return;

		const registry = options.getRegistry();
		if (!registry) return;

		const linkTexts = app.metadataCache.unresolvedLinks[file.path];
		if (!linkTexts) return;

		const bareTerms = Object.keys(linkTexts).filter(isBareTerm);
		if (bareTerms.length === 0) return;

		void processFile(app, registry, file, bareTerms);
	};
}

function isBareTerm(linkText: string): boolean {
	return !linkText.includes('|') && !linkText.includes('#') && !linkText.includes('/');
}

async function processFile(
	app: App,
	registry: RedirectRegistry,
	file: TFile,
	terms: string[],
): Promise<void> {
	const autoFixable: { term: string; canonicalPath: string }[] = [];
	const ambiguous: { term: string; resolution: SwallowResolution }[] = [];
	const aliasConflicts: { term: string; canonicalPath: string; aliasConflictPaths: string[] }[] = [];

	for (const term of terms) {
		const resolution = registry.getSwallowResolution(term);
		if (resolution.status === 'unambiguous' && resolution.canonicalPath) {
			if (resolution.aliasConflictPaths && resolution.aliasConflictPaths.length > 0) {
				aliasConflicts.push({
					term,
					canonicalPath: resolution.canonicalPath,
					aliasConflictPaths: resolution.aliasConflictPaths,
				});
			} else {
				autoFixable.push({ term, canonicalPath: resolution.canonicalPath });
			}
		} else if (resolution.status === 'ambiguous') {
			ambiguous.push({ term, resolution });
		}
		// 'none' and 'collides-with-note' are left untouched.
	}

	if (autoFixable.length > 0) {
		const content = await app.vault.read(file);
		let updated = content;
		let totalCount = 0;
		for (const { term, canonicalPath } of autoFixable) {
			const result = qualifyBareLinksInContent(updated, term, canonicalPath.replace(/\.md$/i, ''));
			updated = result.content;
			totalCount += result.count;
		}
		if (totalCount > 0) {
			await app.vault.modify(file, updated);
			new Notice(
				`Redirects: qualified ${totalCount} link${totalCount === 1 ? '' : 's'} in "${file.basename}" to match swallow claims.`,
			);
		}
	}

	for (const { term, resolution } of ambiguous) {
		if (!resolution.candidatePaths) continue;
		const chosen = await pickFromList(
			app,
			`"${term}" is claimed by multiple notes — choose one`,
			resolution.candidatePaths,
			(p) => p,
		);
		if (!chosen) continue;
		await qualifyOneTerm(app, file, term, chosen);
	}

	for (const { term, canonicalPath, aliasConflictPaths } of aliasConflicts) {
		const choice = await promptAliasConflict(app, term, canonicalPath, aliasConflictPaths);
		if (choice === 'cancel') continue;
		if (choice === 'consolidate') {
			await consolidateAliases(app, aliasConflictPaths, term);
		}
		await qualifyOneTerm(app, file, term, canonicalPath);
	}
}

async function qualifyOneTerm(app: App, file: TFile, term: string, canonicalPath: string): Promise<void> {
	const content = await app.vault.read(file);
	const { content: updated, count } = qualifyBareLinksInContent(
		content,
		term,
		canonicalPath.replace(/\.md$/i, ''),
	);
	if (count > 0) {
		await app.vault.modify(file, updated);
		new Notice(`"${term}" qualified to "${canonicalPath}" in "${file.basename}" (swallow claim).`);
	}
}

async function consolidateAliases(app: App, holderPaths: string[], term: string): Promise<void> {
	for (const holderPath of holderPaths) {
		const holder = app.vault.getAbstractFileByPath(holderPath);
		if (!(holder instanceof TFile)) continue;
		await app.fileManager.processFrontMatter(holder, (fm: Record<string, unknown>) => {
			fm.aliases = withAliasRemoved(fm.aliases, term);
		});
	}
	new Notice(`Removed "${term}" as an alias from: ${holderPaths.join(', ')}.`);
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
	return ignoredFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
}
