import { App, Modal, Setting } from 'obsidian';

/**
 * Shows a preview of the mutation about to happen and asks for explicit
 * confirmation. Every authoring/repair command (issue #5) goes through this
 * before writing anything.
 */
export function confirmMutation(
	app: App,
	title: string,
	previewLines: string[],
): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new (class extends Modal {
			onOpen(): void {
				const { contentEl } = this;
				contentEl.empty();
				contentEl.createEl('h2', { text: title });
				const pre = contentEl.createEl('pre');
				pre.setText(previewLines.join('\n'));

				new Setting(contentEl)
					.addButton((btn) =>
						btn
							.setButtonText('Apply')
							.setCta()
							.onClick(() => {
								settled = true;
								this.close();
								resolve(true);
							}),
					)
					.addButton((btn) =>
						btn.setButtonText('Cancel').onClick(() => this.close()),
					);
			}

			onClose(): void {
				this.contentEl.empty();
				if (!settled) {
					settled = true;
					resolve(false);
				}
			}
		})(app);
		modal.open();
	});
}
