/**
 * What runs after every registry rebuild: the reciprocal sync, then the
 * two-way/alias sync. Kept out of `main.ts` so the plugin entry point stays
 * lifecycle-only. The two run one after the other, never in parallel: both
 * write frontmatter, and the second shouldn't race the first's writes.
 */

import { App } from 'obsidian';
import { RedirectsPluginData } from '../data/plugin-data';
import { syncRedirectPairs } from './pair-sync';
import { syncMissingReciprocals } from './reciprocal-sync';
import { RedirectRegistry } from './registry';

export async function runAutoSync(
	app: App,
	registry: RedirectRegistry,
	data: RedirectsPluginData,
): Promise<void> {
	if (data.autoSyncReciprocals) await syncMissingReciprocals(app, registry);
	await syncRedirectPairs(app, registry, {
		addRedirectsTo: data.autoSyncRedirectsTo,
		aliasStubOnCanonical: data.aliasStubOnCanonical,
		aliasCanonicalOnStub: data.aliasCanonicalOnStub,
	});
}
