/**
 * Keeps a note's `aliases` in step with its `swallows` list: every term a
 * note swallows is also one of its aliases, so Obsidian's own link
 * suggestions offer the note under that name. Only a valid claimant (not a
 * redirect stub or disambiguation page, whose claims are ignored anyway)
 * is touched. Idempotent: once every term is an alias nothing is written,
 * which is what stops the write from retriggering itself.
 */

import { App, TFile, parseFrontMatterAliases } from 'obsidian';
import { withAliasesAdded } from '../authoring/mutations';
import { parseContract } from '../contract/frontmatter';
import { termsMissingFromAliases } from './alias-terms';

export interface SwallowAliasOptions {
	isEnabled: () => boolean;
	getIgnoredFolders: () => string[];
}

export function createSwallowAliasHandler(app: App, options: SwallowAliasOptions) {
	return (file: TFile): void => {
		if (!options.isEnabled()) return;
		if (file.extension !== 'md') return;
		if (options.getIgnoredFolders().some((f) => file.path === f || file.path.startsWith(`${f}/`))) return;

		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
		const contract = parseContract(frontmatter);
		if (contract.redirectTo || contract.disambiguates.length > 0) return;

		const aliases = parseFrontMatterAliases(frontmatter ?? null) ?? [];
		const missing = termsMissingFromAliases(contract.swallows, aliases, file.basename);
		if (missing.length === 0) return;

		void app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.aliases = withAliasesAdded(fm.aliases, missing);
		});
	};
}
