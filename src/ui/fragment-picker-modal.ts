import { App, SuggestModal } from 'obsidian';

export interface FragmentChoice {
	label: string;
	heading?: string;
	blockId?: string;
}

/** Picks a fragment (whole note, a heading, or a block id) within one note. */
export class FragmentPickerModal extends SuggestModal<FragmentChoice> {
	private readonly choices: FragmentChoice[];

	constructor(
		app: App,
		noteBasename: string,
		headings: string[],
		blockIds: string[],
		private onChoose: (choice: FragmentChoice | undefined) => void,
	) {
		super(app);
		this.setPlaceholder(`Link to "${noteBasename}" itself, a heading, or a block…`);
		this.choices = [
			{ label: '(the whole note)' },
			...headings.map((heading) => ({ label: `# ${heading}`, heading })),
			...blockIds.map((blockId) => ({ label: `^${blockId}`, blockId })),
		];
	}

	getSuggestions(query: string): FragmentChoice[] {
		const q = query.trim().toLowerCase();
		if (!q) return this.choices;
		return this.choices.filter((c) => c.label.toLowerCase().includes(q));
	}

	renderSuggestion(choice: FragmentChoice, el: HTMLElement): void {
		el.setText(choice.label);
	}

	onChooseSuggestion(choice: FragmentChoice): void {
		this.onChoose(choice);
	}
}

export function pickFragment(
	app: App,
	noteBasename: string,
	headings: string[],
	blockIds: string[],
): Promise<FragmentChoice | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new FragmentPickerModal(app, noteBasename, headings, blockIds, (choice) => {
			settled = true;
			resolve(choice);
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
