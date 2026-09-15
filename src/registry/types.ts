/**
 * Vault abstraction consumed by the registry (issue #2). Kept independent of
 * the `obsidian` module so the registry can be unit tested without a running
 * app; `src/obsidian-adapter.ts` implements this against the real API.
 */

export interface VaultNoteFile {
	/** Vault-relative path, including the `.md` extension. */
	path: string;
	/** Filename without extension. */
	basename: string;
	/** Alias strings declared in this note's frontmatter, if any. */
	aliases: string[];
	/** Already-YAML-parsed frontmatter, if any. */
	frontmatter: Record<string, unknown> | undefined;
	/** Heading texts present in the note body, in document order. */
	headings: string[];
	/** Block ids (without the leading `^`) present in the note body. */
	blockIds: string[];
	/** True when the note has non-trivial body content beyond frontmatter. */
	hasBodyContent: boolean;
}

export interface VaultSource {
	getFiles(): VaultNoteFile[];
}
