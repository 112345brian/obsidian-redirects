import { App, Modal, Setting } from 'obsidian';

/** A single-field text prompt, resolved on submit and `undefined` on cancel. */
export class TextInputModal extends Modal {
	private value = '';
	private resolved = false;

	constructor(
		app: App,
		private title: string,
		private placeholder: string,
		private onSubmit: (value: string | undefined) => void,
		private initialValue = '',
	) {
		super(app);
		this.value = initialValue;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.title });

		new Setting(contentEl).setName('Name').addText((text) => {
			text
				.setPlaceholder(this.placeholder)
				.setValue(this.initialValue)
				.onChange((v) => (this.value = v));
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') {
					evt.preventDefault();
					this.submit();
				}
			});
			text.inputEl.focus();
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Continue')
				.setCta()
				.onClick(() => this.submit()),
		);
	}

	private submit(): void {
		this.resolved = true;
		this.close();
		this.onSubmit(this.value.trim() || undefined);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) this.onSubmit(undefined);
	}
}

/** Promise-based wrapper around {@link TextInputModal}. */
export function promptText(
	app: App,
	title: string,
	placeholder: string,
	initialValue = '',
): Promise<string | undefined> {
	return new Promise((resolve) => {
		new TextInputModal(app, title, placeholder, resolve, initialValue).open();
	});
}
