/**
 * Wires the heading/note collision cue (issue #7) into the real Obsidian
 * app: scans the current vault snapshot, and only writes anything on the
 * explicit "link" action — "register as landing section" and "dismiss" just
 * record that the collision has been handled.
 */

import { App, Notice, TFile } from 'obsidian';
import { RedirectsPluginData } from '../data/plugin-data';
import { VaultSource } from '../registry/types';
import { CollisionModal } from './collision-modal';
import { insertLinkAfterHeading } from './insert-link';
import { collisionKey, computeHeadingCollisions } from './scan';

export interface CollisionDataController {
	getData(): RedirectsPluginData;
	saveData(data: RedirectsPluginData): Promise<void>;
}

export async function showHeadingCollisions(
	app: App,
	source: VaultSource,
	controller: CollisionDataController,
): Promise<void> {
	const data = controller.getData();
	const collisions = computeHeadingCollisions(
		source.getFiles(),
		new Set(data.handledHeadingCollisions),
	);

	new CollisionModal(app, collisions, async (collision, action) => {
		const key = collisionKey(collision.sourcePath, collision.heading);

		if (action.kind === 'link') {
			const candidateNoExt = action.candidatePath.replace(/\.md$/i, '');
			const file = app.vault.getAbstractFileByPath(collision.sourcePath);
			if (file instanceof TFile) {
				await app.vault.process(file, (content) =>
					insertLinkAfterHeading(content, collision.heading, `[[${candidateNoExt}]]`),
				);
			}
			new Notice(`Linked "${collision.heading}" to "${action.candidatePath}".`);
		} else if (action.kind === 'landing') {
			new Notice(`"${collision.heading}" registered as a local landing section.`);
		} else {
			new Notice(`Dismissed "${collision.heading}" in "${collision.sourcePath}".`);
		}

		const current = controller.getData();
		if (!current.handledHeadingCollisions.includes(key)) {
			await controller.saveData({
				...current,
				handledHeadingCollisions: [...current.handledHeadingCollisions, key],
			});
		}
	}).open();
}
