import { App, Modal, Setting } from 'obsidian';
import { pickFromList } from '../ui/string-picker-modal';
import { HeadingCollision } from './scan';

export type CollisionAction =
	| { kind: 'link'; candidatePath: string }
	| { kind: 'landing' }
	| { kind: 'dismiss' };

/**
 * Lists heading/note collisions (issue #7). Never assumes semantic identity:
 * an ambiguous collision always shows a chooser over its candidates rather
 * than picking one, and "register as local landing section" is offered
 * alongside "link" so a legitimately local heading isn't forced to link out.
 */
export class CollisionModal extends Modal {
	constructor(
		app: App,
		private collisions: HeadingCollision[],
		private onAction: (collision: HeadingCollision, action: CollisionAction) => void | Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Heading / note collisions' });

		if (this.collisions.length === 0) {
			contentEl.createEl('p', { text: 'No unhandled heading collides with an existing note title or alias.' });
			return;
		}

		for (const collision of this.collisions) {
			const section = contentEl.createDiv({ cls: 'redirects-collision-item' });
			section.createEl('h3', { text: `"${collision.heading}" in ${collision.sourcePath}` });
			section.createEl('p', {
				text: `Matches: ${collision.candidatePaths.join(', ')}`,
			});

			const setting = new Setting(section);
			if (collision.candidatePaths.length === 1) {
				const candidatePath = collision.candidatePaths[0]!;
				setting.addButton((btn) =>
					btn
						.setButtonText(`Link to "${candidatePath}"`)
						.onClick(() => void this.onAction(collision, { kind: 'link', candidatePath })),
				);
			} else {
				setting.addButton((btn) =>
					btn.setButtonText('Choose target…').onClick(() => void this.chooseTarget(collision)),
				);
			}
			setting.addButton((btn) =>
				btn
					.setButtonText('Register as local landing section')
					.onClick(() => void this.onAction(collision, { kind: 'landing' })),
			);
			setting.addButton((btn) =>
				btn.setButtonText('Dismiss').onClick(() => void this.onAction(collision, { kind: 'dismiss' })),
			);
		}
	}

	private async chooseTarget(collision: HeadingCollision): Promise<void> {
		const candidatePath = await pickFromList(
			this.app,
			`Which note does "${collision.heading}" mean?`,
			collision.candidatePaths,
			(p) => p,
		);
		if (!candidatePath) return;
		await this.onAction(collision, { kind: 'link', candidatePath });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
