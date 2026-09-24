import { App, Modal, Setting } from 'obsidian';
import { PromotableTarget } from './scan';

export type PromotableAction = 'create-note' | 'create-redirect' | 'create-disambiguation' | 'dismiss';

/**
 * Lists promotable unresolved-link targets (issue #6) with their distinct
 * source notes visible before any action, and the four explicit choices —
 * nothing here creates or dismisses anything on its own.
 */
export class PromotableLinksModal extends Modal {
	constructor(
		app: App,
		private targets: PromotableTarget[],
		private onAction: (target: PromotableTarget, action: PromotableAction) => void | Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Promotable unresolved links' });

		if (this.targets.length === 0) {
			contentEl.createEl('p', { text: 'No unresolved link has enough distinct sources yet.' });
			return;
		}

		for (const target of this.targets) {
			const section = contentEl.createDiv({ cls: 'redirects-promotable-item' });
			section.createEl('h3', { text: target.target });
			section.createEl('p', {
				text: `Referenced from ${target.sources.length} notes: ${target.sources.join(', ')}`,
			});

			const setting = new Setting(section);
			setting.addButton((btn) =>
				btn.setButtonText('Create canonical note').onClick(() => void this.onAction(target, 'create-note')),
			);
			setting.addButton((btn) =>
				btn.setButtonText('Create redirect').onClick(() => void this.onAction(target, 'create-redirect')),
			);
			setting.addButton((btn) =>
				btn
					.setButtonText('Create disambiguation page')
					.onClick(() => void this.onAction(target, 'create-disambiguation')),
			);
			setting.addButton((btn) =>
				btn.setButtonText('Dismiss').onClick(() => void this.onAction(target, 'dismiss')),
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
