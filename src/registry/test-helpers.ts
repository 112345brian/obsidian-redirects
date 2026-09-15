import { VaultNoteFile, VaultSource } from './types';

export function file(overrides: Partial<VaultNoteFile> & { path: string }): VaultNoteFile {
	return {
		basename: overrides.path.replace(/\.md$/, '').split('/').pop()!,
		aliases: [],
		frontmatter: undefined,
		headings: [],
		blockIds: [],
		hasBodyContent: false,
		...overrides,
	};
}

export function vaultOf(files: VaultNoteFile[]): VaultSource {
	return { getFiles: () => files };
}
