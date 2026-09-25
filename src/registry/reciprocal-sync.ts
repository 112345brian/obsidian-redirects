/**
 * Auto-populates a missing `redirects_from` reciprocal the moment a stub's
 * `redirect_to` makes one necessary (issue #2): given `redirect_to`, the
 * reciprocal entry is a deterministic consequence, not a judgment call, so
 * it's added automatically with a summary Notice — the same "declaring X is
 * itself the authorization for the mechanical consequence Y" contract the
 * swallow-claim fix-on-save uses. A *stale* reciprocal (the claim no longer
 * matches reality) is deliberately left for the "Repair a reciprocal
 * redirect declaration" command instead: removing text based on a guess at
 * intent risks discarding a typo the user meant to fix, not delete.
 */

import { App, Notice, TFile } from 'obsidian';
import { withWikilinkAdded } from '../authoring/mutations';
import { REDIRECTS_FROM_KEY } from '../contract/frontmatter';
import { formatWikilink } from '../contract/wikilink';
import { RedirectRegistry } from './registry';

export async function syncMissingReciprocals(app: App, registry: RedirectRegistry): Promise<void> {
	const issues = registry.getHealthReport().filter((issue) => issue.type === 'missing-reciprocal');
	if (issues.length === 0) return;

	let added = 0;
	for (const issue of issues) {
		const stubPath = issue.related?.[0];
		if (!stubPath) continue;

		const canonicalFile = app.vault.getAbstractFileByPath(issue.path);
		if (!(canonicalFile instanceof TFile)) continue;

		const stubTarget = {
			path: stubPath.replace(/\.md$/i, ''),
			raw: formatWikilink({ path: stubPath.replace(/\.md$/i, '') }),
		};

		await app.fileManager.processFrontMatter(canonicalFile, (fm: Record<string, unknown>) => {
			fm[REDIRECTS_FROM_KEY] = withWikilinkAdded(fm[REDIRECTS_FROM_KEY], stubTarget);
		});
		added++;
	}

	if (added > 0) {
		new Notice(`Redirects: added ${added} missing reciprocal declaration${added === 1 ? '' : 's'}.`);
	}
}
