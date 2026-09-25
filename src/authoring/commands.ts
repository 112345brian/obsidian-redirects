/**
 * Explicit authoring and reciprocal-repair commands (issue #5): create a
 * redirect stub, add a disambiguation page, repair a reciprocal declaration,
 * or insert a path-qualified `[[path|label]]` link for selected prose. Every
 * mutation is previewed and confirmed before it is applied; frontmatter
 * writes go through `processFrontMatter` and text insertion goes through the
 * editor, so both participate in Obsidian's normal undo.
 */

import { App, Editor, Notice, TFile } from 'obsidian';
import {
	DISAMBIGUATES_KEY,
	REDIRECTS_FROM_KEY,
	REDIRECT_TO_KEY,
} from '../contract/frontmatter';
import { WikilinkTarget, formatWikilink } from '../contract/wikilink';
import { RedirectRegistry } from '../registry/registry';
import { HealthIssue } from '../registry/health';
import { applyReciprocalFix, reciprocalFixPreview } from '../registry/reciprocal-sync';
import { confirmMutation } from '../ui/confirm-modal';
import { pickFromList } from '../ui/string-picker-modal';
import { promptText } from '../ui/text-input-modal';
import { stubFrontmatterText, withWikilinkAdded } from './mutations';
import { pickTarget } from './pick-target';

export function toFilePath(name: string): string {
	const trimmed = name.trim().replace(/^\/+/, '');
	return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
}

/**
 * Creates a redirect stub at `stubPath` pointing at `target`, previewing the
 * mutation first. Shared by the direct "Create redirect stub" command and
 * the promotable-unresolved-links cue (issue #6).
 */
export async function createRedirectStubNamed(
	app: App,
	stubPath: string,
	target: WikilinkTarget,
): Promise<boolean> {
	if (app.vault.getAbstractFileByPath(stubPath)) {
		new Notice(`"${stubPath}" already exists; choose a different name.`);
		return false;
	}

	const targetFile =
		app.vault.getAbstractFileByPath(`${target.path}.md`) ?? app.vault.getAbstractFileByPath(target.path);
	const canonicalPath = targetFile instanceof TFile ? targetFile.path : undefined;

	const preview = [
		`Create "${stubPath}" with:`,
		`  ${REDIRECT_TO_KEY}: "${formatWikilink(target)}"`,
	];
	if (canonicalPath) {
		preview.push('', `Add to "${canonicalPath}":`, `  ${REDIRECTS_FROM_KEY}: [..., "[[${stubPath.replace(/\.md$/i, '')}]]"]`);
	} else {
		preview.push('', `("${target.path}" does not resolve to an existing file — no reciprocal declaration will be added.)`);
	}

	const confirmed = await confirmMutation(app, 'Create redirect stub', preview);
	if (!confirmed) return false;

	await app.vault.create(stubPath, stubFrontmatterText(REDIRECT_TO_KEY, target));

	if (canonicalPath) {
		const stubTarget = { path: stubPath.replace(/\.md$/i, ''), raw: formatWikilink({ path: stubPath.replace(/\.md$/i, '') }) };
		const canonicalFile = app.vault.getAbstractFileByPath(canonicalPath);
		if (canonicalFile instanceof TFile) {
			await app.fileManager.processFrontMatter(canonicalFile, (fm: Record<string, unknown>) => {
				fm[REDIRECTS_FROM_KEY] = withWikilinkAdded(fm[REDIRECTS_FROM_KEY], stubTarget);
			});
		}
	}

	new Notice(`Created redirect stub "${stubPath}".`);
	return true;
}

export async function createRedirectStub(app: App): Promise<void> {
	const target = await pickTarget(app);
	if (!target) return;

	const stubName = await promptText(app, 'Create redirect stub', 'e.g. Old name');
	if (!stubName) return;

	await createRedirectStubNamed(app, toFilePath(stubName), target);
}

export async function addDisambiguationCandidate(app: App): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	const noteName = await promptText(
		app,
		'Add disambiguation candidate to…',
		'Existing or new note name',
		activeFile?.basename ?? '',
	);
	if (!noteName) return;

	const notePath = toFilePath(noteName);
	const candidate = await pickTarget(app);
	if (!candidate) return;

	await addDisambiguationCandidateTo(app, notePath, candidate);
}

/**
 * Adds `candidate` to `notePath`'s `disambiguates` list, creating the note
 * first if it doesn't exist yet. Shared with the heading/note collision cue
 * (issue #7) and the promotable-links cue (issue #6).
 */
export async function addDisambiguationCandidateTo(
	app: App,
	notePath: string,
	candidate: WikilinkTarget,
): Promise<boolean> {
	const existingFile = app.vault.getAbstractFileByPath(notePath);
	const preview = [
		existingFile ? `Update "${notePath}":` : `Create "${notePath}" with:`,
		`  ${DISAMBIGUATES_KEY}: [..., "${formatWikilink(candidate)}"]`,
	];

	const confirmed = await confirmMutation(app, 'Add disambiguation candidate', preview);
	if (!confirmed) return false;

	let file = existingFile;
	if (!(file instanceof TFile)) {
		await app.vault.create(notePath, '---\n---\n');
		file = app.vault.getAbstractFileByPath(notePath);
	}
	if (!(file instanceof TFile)) return false;

	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm[DISAMBIGUATES_KEY] = withWikilinkAdded(fm[DISAMBIGUATES_KEY], candidate);
	});

	new Notice(`Added "${formatWikilink(candidate)}" to "${notePath}".`);
	return true;
}

function reciprocalIssues(registry: RedirectRegistry | undefined): HealthIssue[] {
	return (registry?.getHealthReport() ?? []).filter(
		(issue) => issue.type === 'missing-reciprocal' || issue.type === 'stale-reciprocal',
	);
}

export async function repairReciprocals(app: App, registry: RedirectRegistry | undefined): Promise<void> {
	const issues = reciprocalIssues(registry);
	if (issues.length === 0) {
		new Notice('No reciprocal declarations need repair.');
		return;
	}

	const issue = await pickFromList(
		app,
		'Choose a reciprocal declaration to repair…',
		issues,
		(i) => i.message,
	);
	if (!issue) return;

	const title = issue.type === 'missing-reciprocal' ? 'Add missing reciprocal declaration' : 'Remove stale reciprocal declaration';
	const confirmed = await confirmMutation(app, title, reciprocalFixPreview(issue));
	if (!confirmed) return;

	const applied = await applyReciprocalFix(app, issue);
	if (applied) new Notice(`Repaired reciprocal declaration on "${issue.path}".`);
}

export async function insertQualifiedLink(app: App, editor: Editor): Promise<void> {
	const selection = editor.getSelection();
	const target = await pickTarget(app);
	if (!target) return;

	const label = selection || target.heading || target.path.split('/').pop() || target.path;
	editor.replaceSelection(`[[${target.path}${target.heading ? `#${target.heading}` : ''}${target.blockId ? `#^${target.blockId}` : ''}|${label}]]`);
}
