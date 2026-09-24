/**
 * Wires the disambiguation chooser (issue #4) into the real Obsidian app:
 * intercepts `file-open` on a note that declares `disambiguates`, and routes
 * only on an explicit user choice. Dismissing the chooser leaves the
 * disambiguation page open and changes nothing.
 */

import { App, Notice, TFile } from 'obsidian';
import { RedirectRegistry } from '../registry/registry';
import { DisambiguationModal } from './disambiguation-modal';

export class DisambiguationRouter {
	private bypassNextOpen = false;
	private navigatingToPath: string | undefined;

	constructor(
		private app: App,
		private getRegistry: () => RedirectRegistry | undefined,
	) {}

	/** Suppresses chooser-opening for the very next `file-open`. */
	bypassNext(): void {
		this.bypassNextOpen = true;
	}

	handleFileOpen(file: TFile | null): void {
		if (!file) return;

		if (this.bypassNextOpen) {
			this.bypassNextOpen = false;
			return;
		}

		if (this.navigatingToPath === file.path) {
			this.navigatingToPath = undefined;
			return;
		}

		const registry = this.getRegistry();
		const entry = registry?.getDisambiguation(file.path);
		if (!entry) return;

		if (entry.candidates.length === 0) {
			new Notice(`"${file.basename}" has an empty "disambiguates" list.`);
			return;
		}

		new DisambiguationModal(this.app, file.basename, entry.candidates, (choice) => {
			if (!choice.file) {
				new Notice(
					`That candidate does not resolve (${choice.status}); staying on "${file.basename}".`,
				);
				return;
			}

			this.navigatingToPath = choice.file.path;
			const linktext = choice.target.blockId
				? `${choice.file.path}#^${choice.target.blockId}`
				: choice.target.heading
					? `${choice.file.path}#${choice.target.heading}`
					: choice.file.path;

			void this.app.workspace.openLinkText(linktext, file.path, false);
		}).open();
	}

	/** Opens `path` deliberately, bypassing the chooser for that open. */
	async openBypassingChooser(path: string): Promise<void> {
		const target = this.app.vault.getAbstractFileByPath(path);
		if (!(target instanceof TFile)) return;
		this.bypassNext();
		await this.app.workspace.getLeaf(false).openFile(target);
	}
}
