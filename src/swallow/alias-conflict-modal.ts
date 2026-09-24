import { App, Modal, Setting } from 'obsidian';

export type AliasConflictChoice = 'consolidate' | 'proceed' | 'cancel';

/**
 * Surfaces an unambiguous swallow claim's conflict with an existing,
 * unrelated alias before rewriting anything — consolidating (removing the
 * alias elsewhere) is an explicit choice, never an automatic side effect of
 * declaring or resolving a claim.
 */
export function promptAliasConflict(
	app: App,
	term: string,
	canonicalPath: string,
	aliasHolderPaths: string[],
): Promise<AliasConflictChoice> {
	return new Promise((resolve) => {
		let settled = false;
		const settle = (choice: AliasConflictChoice): void => {
			settled = true;
			resolve(choice);
		};

		const modal = new (class extends Modal {
			onOpen(): void {
				const { contentEl } = this;
				contentEl.empty();
				contentEl.createEl('h2', { text: 'Swallow claim conflicts with an existing alias' });
				contentEl.createEl('p', {
					text: `"${term}" is claimed in swallows by "${canonicalPath}", but it's also an alias on: ${aliasHolderPaths.join(', ')}.`,
				});

				new Setting(contentEl)
					.addButton((btn) =>
						btn
							.setButtonText('Consolidate (remove the alias) and proceed')
							.setCta()
							.onClick(() => {
								settle('consolidate');
								this.close();
							}),
					)
					.addButton((btn) =>
						btn.setButtonText('Proceed without consolidating').onClick(() => {
							settle('proceed');
							this.close();
						}),
					)
					.addButton((btn) =>
						btn.setButtonText('Cancel').onClick(() => {
							settle('cancel');
							this.close();
						}),
					);
			}

			onClose(): void {
				this.contentEl.empty();
				if (!settled) settle('cancel');
			}
		})(app);
		modal.open();
	});
}
