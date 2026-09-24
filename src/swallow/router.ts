/**
 * Wires the authoring-time swallow rewrite (issue #10) into the real
 * Obsidian app: on `editor-change`, checks whether the author just closed a
 * bare `[[Term]]` link that exactly and unambiguously matches a swallow
 * claim, and rewrites it in place via `editor.replaceRange` (a single
 * transaction, so normal undo reverts it in one step). An ambiguous claim
 * shows an explicit chooser instead of guessing; a claim that collides with
 * a real note's exact name is never applied.
 */

import { App, Editor, MarkdownView, Notice } from 'obsidian';
import { RedirectRegistry } from '../registry/registry';
import { pickFromList } from '../ui/string-picker-modal';
import { planSwallowRewrite } from './plan';

export interface SwallowRouterOptions {
	getRegistry: () => RedirectRegistry | undefined;
	getIgnoredFolders: () => string[];
}

export function createSwallowEditorChangeHandler(app: App, options: SwallowRouterOptions) {
	return (editor: Editor): void => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		const path = view?.file?.path;
		if (path && isIgnored(path, options.getIgnoredFolders())) return;

		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const allLines = editor.getValue().split('\n');

		const plan = planSwallowRewrite(line, cursor.ch, allLines, cursor.line);
		if (!plan) return;

		const registry = options.getRegistry();
		if (!registry) return;

		const resolution = registry.getSwallowResolution(plan.term);
		if (resolution.status === 'none' || resolution.status === 'collides-with-note') return;

		if (resolution.status === 'unambiguous' && resolution.canonicalPath) {
			applyRewrite(editor, cursor.line, plan, resolution.canonicalPath);
			return;
		}

		if (resolution.status === 'ambiguous' && resolution.candidatePaths) {
			void pickFromList(
				app,
				`"${plan.term}" is claimed by multiple notes — choose one`,
				resolution.candidatePaths,
				(p) => p,
			).then((chosen) => {
				if (!chosen) return;
				// Re-check the line still has the same bare link before writing —
				// the author may have kept typing while the chooser was open.
				const currentLine = editor.getLine(cursor.line);
				if (currentLine.slice(plan.from, plan.to) !== `[[${plan.term}]]`) return;
				applyRewrite(editor, cursor.line, plan, chosen);
			});
		}
	};
}

function applyRewrite(
	editor: Editor,
	line: number,
	plan: { from: number; to: number; term: string },
	canonicalPath: string,
): void {
	const canonicalNoExt = canonicalPath.replace(/\.md$/i, '');
	const replacement = `[[${canonicalNoExt}|${plan.term}]]`;
	editor.replaceRange(
		replacement,
		{ line, ch: plan.from },
		{ line, ch: plan.to },
	);
	new Notice(`"${plan.term}" qualified to "${canonicalPath}" (swallow claim).`);
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
	return ignoredFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
}
