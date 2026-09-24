import { App } from 'obsidian';
import { WikilinkTarget, formatWikilink } from '../contract/wikilink';
import { pickFragment } from '../ui/fragment-picker-modal';
import { pickNote } from '../ui/note-picker-modal';

/**
 * Full note + fragment pick for the authoring commands (issue #5). Always
 * writes the full vault-relative path (minus the `.md` extension) rather
 * than relying on a possibly-ambiguous bare name/alias, matching the
 * path-qualified-link requirement in issues #5 and #10.
 */
export async function pickTarget(app: App): Promise<WikilinkTarget | undefined> {
	const files = app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
	const file = await pickNote(app, files);
	if (!file) return undefined;

	const cache = app.metadataCache.getFileCache(file);
	const headings = (cache?.headings ?? []).map((h) => h.heading);
	const blockIds = Object.keys(cache?.blocks ?? {});

	const path = file.path.replace(/\.md$/i, '');

	if (headings.length === 0 && blockIds.length === 0) {
		return { path, raw: formatWikilink({ path }) };
	}

	const fragment = await pickFragment(app, file.basename, headings, blockIds);
	if (!fragment) return undefined;

	const target: Omit<WikilinkTarget, 'raw'> = { path };
	if (fragment.heading) target.heading = fragment.heading;
	if (fragment.blockId) target.blockId = fragment.blockId;

	return { ...target, raw: formatWikilink(target) };
}
