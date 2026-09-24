/**
 * Pure detection for heading/note collisions (issue #7): a heading whose
 * normalized text matches an existing note's title or alias is a possible
 * duplicate concept, never an assumed one. `handled` carries the keys
 * (see `collisionKey`) of headings the user has already acted on or
 * dismissed, so a repeat scan doesn't re-surface them.
 */

import { VaultNoteFile } from '../registry/types';

export interface HeadingCollision {
	sourcePath: string;
	heading: string;
	/** Paths of notes whose title or alias matches the heading text. */
	candidatePaths: string[];
}

export function collisionKey(sourcePath: string, heading: string): string {
	return `${sourcePath}#${normalize(heading)}`;
}

export function computeHeadingCollisions(
	files: VaultNoteFile[],
	handled: Set<string>,
): HeadingCollision[] {
	const byName = new Map<string, string[]>();
	for (const file of files) {
		addName(byName, file.basename, file.path);
		for (const alias of file.aliases) addName(byName, alias, file.path);
	}

	const collisions: HeadingCollision[] = [];
	for (const file of files) {
		for (const heading of file.headings) {
			if (handled.has(collisionKey(file.path, heading))) continue;

			const candidatePaths = (byName.get(normalize(heading)) ?? []).filter(
				(path) => path !== file.path,
			);
			if (candidatePaths.length > 0) {
				collisions.push({ sourcePath: file.path, heading, candidatePaths });
			}
		}
	}

	return collisions;
}

function addName(map: Map<string, string[]>, name: string, path: string): void {
	const key = normalize(name);
	if (!key) return;
	const list = map.get(key);
	if (list) {
		if (!list.includes(path)) list.push(path);
	} else {
		map.set(key, [path]);
	}
}

function normalize(value: string): string {
	return value.trim().toLowerCase();
}
