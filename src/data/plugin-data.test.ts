import { describe, expect, it } from 'vitest';
import { DEFAULT_PLUGIN_DATA, mergePluginData } from './plugin-data';

describe('mergePluginData', () => {
	it('falls back to defaults for absent/invalid data', () => {
		expect(mergePluginData(undefined)).toEqual(DEFAULT_PLUGIN_DATA);
		expect(mergePluginData({ promotableThreshold: -1, dismissedPromotableTargets: 'x' })).toEqual(
			DEFAULT_PLUGIN_DATA,
		);
	});

	it('keeps valid stored values', () => {
		expect(
			mergePluginData({
				dismissedPromotableTargets: ['term'],
				promotableThreshold: 3,
				ignoredFolders: ['Templates'],
				handledHeadingCollisions: ['A.md#vector'],
				dismissedSwallowPrompts: ['A.md::R package'],
				autoSyncReciprocals: false,
			}),
		).toEqual({
			dismissedPromotableTargets: ['term'],
			promotableThreshold: 3,
			ignoredFolders: ['Templates'],
			handledHeadingCollisions: ['A.md#vector'],
			dismissedSwallowPrompts: ['A.md::R package'],
			autoSyncReciprocals: false,
			propertyKeys: { redirectTo: 'redirects-to', redirectsFrom: 'redirects-from' },
		});
	});

	it('keeps valid custom property keys and falls back for invalid ones', () => {
		expect(
			mergePluginData({ propertyKeys: { redirectTo: 'redirect_to', redirectsFrom: 'redirect_to' } })
				.propertyKeys,
		).toEqual({ redirectTo: 'redirect_to', redirectsFrom: 'redirects-from' });
		expect(
			mergePluginData({ propertyKeys: { redirectTo: 'has space', redirectsFrom: 42 } }).propertyKeys,
		).toEqual({ redirectTo: 'redirects-to', redirectsFrom: 'redirects-from' });
	});

	it('drops non-string entries from list fields', () => {
		expect(mergePluginData({ dismissedPromotableTargets: ['a', 1, 'b'] }).dismissedPromotableTargets).toEqual([
			'a',
			'b',
		]);
	});
});
