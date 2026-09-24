import { App, parseFrontMatterAliases, TFile } from 'obsidian';
import { VaultNoteFile, VaultSource } from './registry/types';

/** Adapts Obsidian's real App/MetadataCache to the registry's VaultSource. */
export class ObsidianVaultSource implements VaultSource {
	constructor(private app: App) {}

	getFiles(): VaultNoteFile[] {
		return this.app.vault.getMarkdownFiles().map((file) => this.toVaultNoteFile(file));
	}

	private toVaultNoteFile(file: TFile): VaultNoteFile {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		const aliases = parseFrontMatterAliases(cache?.frontmatter ?? null) ?? [];
		const headings = (cache?.headings ?? []).map((h) => h.heading);
		const blockIds = Object.keys(cache?.blocks ?? {});

		const frontmatterEndLine = cache?.frontmatterPosition?.end.line;
		const bodyStartsAt = frontmatterEndLine !== undefined ? frontmatterEndLine + 1 : 0;
		const hasBodyContent =
			(cache?.sections ?? []).some((s) => s.position.start.line >= bodyStartsAt) ||
			headings.length > 0;

		return {
			path: file.path,
			basename: file.basename,
			aliases,
			frontmatter,
			headings,
			blockIds,
			hasBodyContent,
		};
	}
}
