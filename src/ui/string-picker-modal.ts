import { App, FuzzySuggestModal } from 'obsidian';

/** Picks one of a fixed list of labeled items by fuzzy search over its label. */
export function pickFromList<T>(
	app: App,
	placeholder: string,
	items: T[],
	label: (item: T) => string,
): Promise<T | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new (class extends FuzzySuggestModal<T> {
			getItems(): T[] {
				return items;
			}
			getItemText(item: T): string {
				return label(item);
			}
			onChooseItem(item: T): void {
				settled = true;
				resolve(item);
			}
		})(app);
		modal.setPlaceholder(placeholder);
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
