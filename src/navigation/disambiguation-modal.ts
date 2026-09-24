import { App, FuzzySuggestModal } from 'obsidian';
import { ResolvedTarget } from '../registry/resolver';
import { describeCandidate } from './candidate-label';

/**
 * Explicit disambiguation chooser (issue #4). Never picks a default: the
 * modal only closes via an explicit choice or dismissal (which leaves the
 * disambiguation page open, unchanged).
 */
export class DisambiguationModal extends FuzzySuggestModal<ResolvedTarget> {
	constructor(
		app: App,
		private noteBasename: string,
		private candidates: ResolvedTarget[],
		private onChoose: (choice: ResolvedTarget) => void,
	) {
		super(app);
		this.setPlaceholder(`"${noteBasename}" disambiguates — choose the intended destination…`);
	}

	getItems(): ResolvedTarget[] {
		return this.candidates;
	}

	getItemText(item: ResolvedTarget): string {
		return describeCandidate(item);
	}

	onChooseItem(item: ResolvedTarget): void {
		this.onChoose(item);
	}
}
