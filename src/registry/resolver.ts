/**
 * Resolves a parsed wikilink target against the vault. Obsidian's own link
 * resolver is treated as authoritative for note identity; this mirrors its
 * basic precedence (exact path, then unique basename/alias match) without
 * re-implementing shortest-path-wins in full, since ambiguity here should
 * surface as a warning rather than silently pick a note.
 */

import { WikilinkTarget } from '../contract/wikilink';
import { VaultNoteFile } from './types';

export type ResolutionStatus =
	| 'resolved'
	| 'unresolved-note'
	| 'ambiguous-note'
	| 'unresolved-heading'
	| 'unresolved-block';

export interface ResolvedTarget {
	status: ResolutionStatus;
	target: WikilinkTarget;
	/** The resolved file, when status is a "resolved" or fragment-missing case. */
	file?: VaultNoteFile;
	/** All candidate files, when status is 'ambiguous-note'. */
	candidates?: VaultNoteFile[];
}

export class VaultIndex {
	private readonly byPath = new Map<string, VaultNoteFile>();
	private readonly byName = new Map<string, VaultNoteFile[]>();
	private readonly byBasename = new Map<string, VaultNoteFile[]>();

	constructor(files: VaultNoteFile[]) {
		for (const file of files) {
			this.byPath.set(normalizePath(file.path), file);
			this.addName(this.byName, file.basename, file);
			this.addName(this.byBasename, file.basename, file);
			for (const alias of file.aliases) this.addName(this.byName, alias, file);
		}
	}

	private addName(map: Map<string, VaultNoteFile[]>, name: string, file: VaultNoteFile): void {
		const key = normalizeName(name);
		if (!key) return;
		const existing = map.get(key);
		if (existing) {
			if (!existing.includes(file)) existing.push(file);
		} else {
			map.set(key, [file]);
		}
	}

	findByPath(path: string): VaultNoteFile | undefined {
		return this.byPath.get(normalizePath(path));
	}

	findByName(name: string): VaultNoteFile[] {
		return this.byName.get(normalizeName(name)) ?? [];
	}

	/** Files whose actual basename (not an alias) matches `name`. */
	findByBasename(name: string): VaultNoteFile[] {
		return this.byBasename.get(normalizeName(name)) ?? [];
	}
}

export function resolveTarget(
	target: WikilinkTarget,
	index: VaultIndex,
): ResolvedTarget {
	const byPath = index.findByPath(target.path);
	const candidates = byPath ? [byPath] : index.findByName(target.path);

	if (candidates.length === 0) {
		return { status: 'unresolved-note', target };
	}
	if (candidates.length > 1) {
		return { status: 'ambiguous-note', target, candidates };
	}

	const file = candidates[0]!;

	if (target.heading) {
		const found = file.headings.some(
			(h) => normalizeName(h) === normalizeName(target.heading!),
		);
		if (!found) return { status: 'unresolved-heading', target, file };
	}

	if (target.blockId) {
		const found = file.blockIds.includes(target.blockId);
		if (!found) return { status: 'unresolved-block', target, file };
	}

	return { status: 'resolved', target, file };
}

function normalizePath(path: string): string {
	const withExt = path.toLowerCase().endsWith('.md')
		? path
		: `${path}.md`;
	return withExt.toLowerCase();
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}
