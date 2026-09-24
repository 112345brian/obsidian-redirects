/**
 * Wires redirect navigation (issue #3) into the real Obsidian app: intercepts
 * `file-open`, plans the hop with the pure logic in `plan.ts`, and either
 * routes to the resolved target or warns and leaves the stub open. Never
 * rewrites any file.
 */

import { App, Notice, TFile } from 'obsidian';
import { RedirectRegistry } from '../registry/registry';
import { planNavigation } from './plan';

export class RedirectNavigator {
	/** Path of the last stub this navigator redirected away from, for the
	 * explicit "open original redirect" bypass action. */
	private lastStubPath: string | undefined;
	/** Set right before we open the resolved target ourselves, so the
	 * `file-open` that fires for it isn't re-processed as a fresh navigation. */
	private redirectingToPath: string | undefined;
	/** Set right before opening a stub deliberately, so that open isn't
	 * immediately followed again. */
	private bypassNextOpen = false;

	constructor(
		private app: App,
		private getRegistry: () => RedirectRegistry | undefined,
	) {}

	/** Suppresses redirect-following for the very next `file-open`. */
	bypassNext(): void {
		this.bypassNextOpen = true;
	}

	getLastStubPath(): string | undefined {
		return this.lastStubPath;
	}

	async handleFileOpen(file: TFile | null): Promise<void> {
		if (!file) return;

		if (this.bypassNextOpen) {
			this.bypassNextOpen = false;
			return;
		}

		if (this.redirectingToPath === file.path) {
			this.redirectingToPath = undefined;
			return;
		}

		const registry = this.getRegistry();
		if (!registry) return;

		const outcome = planNavigation(registry, file.path);
		switch (outcome.kind) {
			case 'not-a-redirect':
				return;

			case 'cycle':
				new Notice(
					`Redirect cycle detected, staying on "${file.basename}": ${outcome.chain.join(' -> ')}.`,
				);
				return;

			case 'broken':
				new Notice(
					`Redirect target for "${file.basename}" is broken (${outcome.final.status}). Staying on the redirect stub.`,
				);
				return;

			case 'navigate': {
				const target = outcome.target;
				if (!target.file) return;

				this.lastStubPath = file.path;
				this.redirectingToPath = target.file.path;

				const linktext = target.target.blockId
					? `${target.file.path}#^${target.target.blockId}`
					: target.target.heading
						? `${target.file.path}#${target.target.heading}`
						: target.file.path;

				await this.app.workspace.openLinkText(linktext, file.path, false);
				return;
			}
		}
	}

	/** Opens `path` deliberately, bypassing redirect-following for that open. */
	async openBypassingRedirect(path: string): Promise<void> {
		const target = this.app.vault.getAbstractFileByPath(path);
		if (!(target instanceof TFile)) return;
		this.bypassNext();
		await this.app.workspace.getLeaf(false).openFile(target);
	}
}
