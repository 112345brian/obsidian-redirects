/**
 * A minimal in-memory stand-in for the slice of Obsidian's `App` that the
 * adapter modules touch (vault lookup, `processFrontMatter`, the metadata
 * cache). Files are the stub `TFile` (see `obsidian-stub.ts`), so
 * `instanceof TFile` checks in the adapters behave as in the real app.
 */

import type { App } from 'obsidian';
import { TFile } from './obsidian-stub';

export type Frontmatter = Record<string, unknown>;

export interface FakeApp {
	app: App;
	/** Live frontmatter by path; `processFrontMatter` mutates these. */
	frontmatter: Map<string, Frontmatter>;
	/** Paths `processFrontMatter` was called on, in order. */
	writes: string[];
}

export function makeFakeApp(notes: Record<string, Frontmatter>): FakeApp {
	const frontmatter = new Map<string, Frontmatter>(Object.entries(notes));
	const files = new Map([...frontmatter.keys()].map((p) => [p, new TFile(p)]));
	const writes: string[] = [];

	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path) ?? null,
		},
		fileManager: {
			processFrontMatter: (file: { path: string }, fn: (fm: Frontmatter) => void) => {
				writes.push(file.path);
				const fm = frontmatter.get(file.path);
				if (fm) fn(fm);
				return Promise.resolve();
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => ({ frontmatter: frontmatter.get(file.path) }),
		},
	} as unknown as App;

	return { app, frontmatter, writes };
}
