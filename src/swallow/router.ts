/**
 * Wires the authoring-time swallow rewrite (issue #10) into the real
 * Obsidian app.
 *
 * This has to be a CodeMirror 6 extension, not Obsidian's `editor-change`
 * event: Obsidian's default "auto-pair brackets" setting means typing `[[`
 * immediately inserts the matching `]]`, so finishing a link by pressing the
 * right arrow (or clicking away) is a pure cursor move with no document
 * change — `editor-change` never fires for it. `EditorView.updateListener`
 * fires on selection changes too, so it catches that case.
 *
 * An unambiguous swallow claim rewrites the bare link in place via a single
 * CM6 transaction (so one undo reverts it); an ambiguous claim shows an
 * explicit chooser instead of guessing; a claim colliding with a real note's
 * exact name is never applied. Every dispatch is deferred a tick past the
 * triggering update, since CM6 disallows re-dispatching synchronously from
 * inside an update listener.
 */

import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { RedirectRegistry } from '../registry/registry';
import { pickFromList } from '../ui/string-picker-modal';
import { promptAliasConflict } from './alias-conflict-modal';
import { withAliasRemoved } from './consolidate';
import { planSwallowRewrite, SwallowRewritePlan } from './plan';

export interface SwallowRouterOptions {
	getRegistry: () => RedirectRegistry | undefined;
	getIgnoredFolders: () => string[];
}

export function createSwallowUpdateListener(app: App, options: SwallowRouterOptions): Extension {
	return EditorView.updateListener.of((update) => {
		if (!update.docChanged && !update.selectionSet) return;

		const view = app.workspace.getActiveViewOfType(MarkdownView);
		const path = view?.file?.path;
		if (path && isIgnored(path, options.getIgnoredFolders())) return;

		const pos = update.state.selection.main.head;
		const lineInfo = update.state.doc.lineAt(pos);
		const cursorCh = pos - lineInfo.from;
		const allLines = update.state.doc.toString().split('\n');
		const lineIndex = lineInfo.number - 1;

		const plan = planSwallowRewrite(lineInfo.text, cursorCh, allLines, lineIndex);
		if (!plan) return;

		const registry = options.getRegistry();
		if (!registry) return;

		const resolution = registry.getSwallowResolution(plan.term);
		if (resolution.status === 'none' || resolution.status === 'collides-with-note') return;

		const editorView = update.view;
		const lineFrom = lineInfo.from;

		if (resolution.status === 'unambiguous' && resolution.canonicalPath) {
			const canonicalPath = resolution.canonicalPath;
			const aliasConflictPaths = resolution.aliasConflictPaths ?? [];
			queueMicrotask(() => {
				void resolveThenRewrite(app, editorView, lineFrom, plan, canonicalPath, aliasConflictPaths);
			});
			return;
		}

		if (resolution.status === 'ambiguous' && resolution.candidatePaths) {
			const candidatePaths = resolution.candidatePaths;
			queueMicrotask(() => {
				void pickFromList(
					app,
					`"${plan.term}" is claimed by multiple notes — choose one`,
					candidatePaths,
					(p) => p,
				).then((chosen) => {
					if (!chosen) return;
					if (!stillBareMatch(editorView, lineFrom, plan)) return;
					const aliasConflictPaths = registry.getAliasConflictPaths(plan.term, chosen);
					void resolveThenRewrite(app, editorView, lineFrom, plan, chosen, aliasConflictPaths);
				});
			});
		}
	});
}

/** True when the exact bare link this plan matched is still there, unchanged
 * — the author (or a dialog's consolidate step) may have edited the line
 * while an async chooser/dialog was open. */
function stillBareMatch(view: EditorView, lineFrom: number, plan: SwallowRewritePlan): boolean {
	const doc = view.state.doc;
	const from = lineFrom + plan.from;
	const to = lineFrom + plan.to;
	if (to > doc.length) return false;
	return doc.sliceString(from, to) === `[[${plan.term}]]`;
}

async function resolveThenRewrite(
	app: App,
	view: EditorView,
	lineFrom: number,
	plan: SwallowRewritePlan,
	canonicalPath: string,
	aliasConflictPaths: string[],
): Promise<void> {
	if (aliasConflictPaths.length > 0) {
		const choice = await promptAliasConflict(app, plan.term, canonicalPath, aliasConflictPaths);
		if (choice === 'cancel') return;
		if (choice === 'consolidate') {
			await consolidateAliases(app, aliasConflictPaths, plan.term);
		}
	}

	if (!stillBareMatch(view, lineFrom, plan)) return;
	applyRewrite(view, lineFrom, plan, canonicalPath);
}

async function consolidateAliases(app: App, holderPaths: string[], term: string): Promise<void> {
	for (const holderPath of holderPaths) {
		const file = app.vault.getAbstractFileByPath(holderPath);
		if (!(file instanceof TFile)) continue;
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.aliases = withAliasRemoved(fm.aliases, term);
		});
	}
	new Notice(`Removed "${term}" as an alias from: ${holderPaths.join(', ')}.`);
}

function applyRewrite(
	view: EditorView,
	lineFrom: number,
	plan: SwallowRewritePlan,
	canonicalPath: string,
): void {
	const canonicalNoExt = canonicalPath.replace(/\.md$/i, '');
	const replacement = `[[${canonicalNoExt}|${plan.term}]]`;
	view.dispatch({
		changes: { from: lineFrom + plan.from, to: lineFrom + plan.to, insert: replacement },
	});
	new Notice(`"${plan.term}" qualified to "${canonicalPath}" (swallow claim).`);
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
	return ignoredFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
}
