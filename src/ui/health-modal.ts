import { App, Modal } from 'obsidian';
import { HealthIssue } from '../registry/health';

/** Read-only view of the registry's health report. Never mutates the vault. */
export class HealthReportModal extends Modal {
	constructor(
		app: App,
		private getIssues: () => HealthIssue[],
	) {
		super(app);
	}

	onOpen(): void {
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
			const item = list.createEl('li');
			item.createSpan({ text: `[${issue.type}] `, cls: 'redirects-health-type' });
			item.appendText(issue.message);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
