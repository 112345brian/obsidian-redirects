import { App, Modal, Setting } from 'obsidian';
import { HealthIssue, HealthIssueType } from '../registry/health';

const FIXABLE_TYPES: ReadonlySet<HealthIssueType> = new Set(['missing-reciprocal', 'stale-reciprocal']);

export function isFixableHealthIssue(issue: HealthIssue): boolean {
	return FIXABLE_TYPES.has(issue.type);
}

/**
 * The registry's health report. Read-only except for a "Fix" button on
 * issue types with one unambiguous, deterministic resolution (a missing or
 * stale reciprocal declaration) — pressing it *is* the confirmation, since
 * the issue's own message already showed what it claims and why. Anything
 * requiring a real choice (a duplicate or colliding claim, for instance)
 * has no button here; it's why those checks exist as a warning rather than
 * an auto-fix in the first place.
 */
export class HealthReportModal extends Modal {
	constructor(
		app: App,
		private getIssues: () => HealthIssue[],
		private onFix?: (issue: HealthIssue) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Redirect health report' });

		const issues = this.getIssues();
		if (issues.length === 0) {
			contentEl.createEl('p', { text: 'No issues found.' });
			return;
		}

		const list = contentEl.createEl('ul');
		for (const issue of issues) {
			const item = list.createEl('li', { cls: 'redirects-health-item' });
			const text = item.createSpan();
			text.createSpan({ text: `[${issue.type}] `, cls: 'redirects-health-type' });
			text.appendText(issue.message);

			if (this.onFix && isFixableHealthIssue(issue)) {
				new Setting(item).addButton((btn) =>
					btn.setButtonText('Fix').onClick(async () => {
						btn.setDisabled(true);
						await this.onFix?.(issue);
						item.remove();
					}),
				);
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
