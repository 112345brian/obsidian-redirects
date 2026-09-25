/**
 * Reciprocal-declaration fixes (issue #2), shared by three callers: the
 * automatic sync that runs after every rebuild, the "Repair a reciprocal
 * redirect declaration" command's chooser, and the health report's per-issue
 * "Fix" button. `applyReciprocalFix` itself never asks for confirmation —
 * that's the caller's job, and differs by context (a background auto-sync
 * doesn't ask at all; the command previews first; the health report's "Fix"
 * button treats the click itself as the confirmation, the issue's own
 * message having already been the preview).
 *
 * A missing reciprocal is a deterministic consequence of `redirect_to`, not
 * a judgment call, so the automatic sync adds it with no confirmation at
 * all (see `syncMissingReciprocals`). A *stale* reciprocal is never
 * auto-applied: removing text based on a guess at intent risks discarding a
 * typo the user meant to fix, not delete — it always takes an explicit
 * command or button press.
 */

import { App, Notice, TFile } from 'obsidian';
import { withWikilinkAdded, withWikilinkRemoved } from '../authoring/mutations';
import { REDIRECTS_FROM_KEY } from '../contract/frontmatter';
import { formatWikilink } from '../contract/wikilink';
import { HealthIssue } from './health';
import { RedirectRegistry } from './registry';

export { reciprocalFixPreview } from './reciprocal-fix-preview';

/**
 * Applies a single missing/stale reciprocal fix with no confirmation of its
 * own. Returns false (a no-op) for any other issue type, or if the file or
 * the related path is missing.
 */
export async function applyReciprocalFix(app: App, issue: HealthIssue): Promise<boolean> {
	if (issue.type !== 'missing-reciprocal' && issue.type !== 'stale-reciprocal') return false;

	const canonicalFile = app.vault.getAbstractFileByPath(issue.path);
	if (!(canonicalFile instanceof TFile)) return false;

	const related = issue.related?.[0];
	if (!related) return false;

	if (issue.type === 'missing-reciprocal') {
		// `related` is the stub's real file path (see `missingReciprocalIssue`).
		const stubTarget = {
			path: related.replace(/\.md$/i, ''),
			raw: formatWikilink({ path: related.replace(/\.md$/i, '') }),
		};
		await app.fileManager.processFrontMatter(canonicalFile, (fm: Record<string, unknown>) => {
			fm[REDIRECTS_FROM_KEY] = withWikilinkAdded(fm[REDIRECTS_FROM_KEY], stubTarget);
		});
	} else {
		// `related` is the claim's exact raw wikilink text (see
		// `staleReciprocalIssue`) — removing anything else risks leaving the
		// actually-written entry untouched.
		await app.fileManager.processFrontMatter(canonicalFile, (fm: Record<string, unknown>) => {
			fm[REDIRECTS_FROM_KEY] = withWikilinkRemoved(fm[REDIRECTS_FROM_KEY], related);
		});
	}

	return true;
}

/** Auto-syncs every missing reciprocal after a rebuild — no confirmation,
 * since redirect_to already made the reciprocal a foregone conclusion. */
export async function syncMissingReciprocals(app: App, registry: RedirectRegistry): Promise<void> {
	const issues = registry.getHealthReport().filter((issue) => issue.type === 'missing-reciprocal');
	if (issues.length === 0) return;

	let added = 0;
	for (const issue of issues) {
		if (await applyReciprocalFix(app, issue)) added++;
	}

	if (added > 0) {
		new Notice(`Redirects: added ${added} missing reciprocal declaration${added === 1 ? '' : 's'}.`);
	}
}
