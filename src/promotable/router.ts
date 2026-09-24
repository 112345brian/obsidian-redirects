/**
 * Wires the promotable-unresolved-links cue (issue #6) into the real
 * Obsidian app: reads the cache Obsidian already maintains
 * (`metadataCache.unresolvedLinks`), and only acts on an explicit choice
 * from the modal — including "Dismiss", which just records a preference.
 */

import { App, Notice } from 'obsidian';
import { addDisambiguationCandidateTo, createRedirectStubNamed, toFilePath } from '../authoring/commands';
import { pickTarget } from '../authoring/pick-target';
import { RedirectsPluginData } from '../data/plugin-data';
import { confirmMutation } from '../ui/confirm-modal';
import { PromotableLinksModal } from './promotable-modal';
import { computePromotableTargets, normalizeKey } from './scan';

export interface PromotableDataController {
	getData(): RedirectsPluginData;
	saveData(data: RedirectsPluginData): Promise<void>;
}

export async function showPromotableLinks(app: App, controller: PromotableDataController): Promise<void> {
	const data = controller.getData();
	const targets = computePromotableTargets(app.metadataCache.unresolvedLinks, {
		threshold: data.promotableThreshold,
		ignoredFolders: data.ignoredFolders,
		dismissed: new Set(data.dismissedPromotableTargets),
	});

	new PromotableLinksModal(app, targets, async (target, action) => {
		switch (action) {
			case 'dismiss': {
				const key = normalizeKey(target.target);
				const current = controller.getData();
				if (!current.dismissedPromotableTargets.includes(key)) {
					await controller.saveData({
						...current,
						dismissedPromotableTargets: [...current.dismissedPromotableTargets, key],
					});
				}
				new Notice(`Dismissed "${target.target}".`);
				return;
			}

			case 'create-note': {
				const path = toFilePath(target.target);
				if (app.vault.getAbstractFileByPath(path)) {
					new Notice(`"${path}" already exists.`);
					return;
				}
				const confirmed = await confirmMutation(app, 'Create canonical note', [`Create "${path}".`]);
				if (!confirmed) return;
				await app.vault.create(path, '');
				new Notice(`Created "${path}".`);
				return;
			}

			case 'create-redirect': {
				const chosen = await pickTarget(app);
				if (!chosen) return;
				await createRedirectStubNamed(app, toFilePath(target.target), chosen);
				return;
			}

			case 'create-disambiguation': {
				const candidate = await pickTarget(app);
				if (!candidate) return;
				await addDisambiguationCandidateTo(app, toFilePath(target.target), candidate);
				return;
			}
		}
	}).open();
}
