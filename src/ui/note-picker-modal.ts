import { App, FuzzySuggestModal, TFile } from 'obsidian';

/** Picks an existing note by path/alias-friendly fuzzy search over its basename. */
export class NotePickerModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private files: TFile[],
		private onChoose: (file: TFile | undefined) => void,
	) {
		super(app);
		this.setPlaceholder('Choose a note…');
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.onChoose(item);
	}
}

/** Promise-based wrapper: resolves to `undefined` if the picker is dismissed. */
export function pickNote(app: App, files: TFile[]): Promise<TFile | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new NotePickerModal(app, files, (file) => {
			settled = true;
			resolve(file);
		});
		const originalClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalClose();
			if (!settled) {
				settled = true;
				resolve(undefined);
			}
		};
		modal.open();
	});
}
