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
			}),
		).toEqual({
			dismissedPromotableTargets: ['term'],
			promotableThreshold: 3,
			ignoredFolders: ['Templates'],
		});
	});

	it('drops non-string entries from list fields', () => {
		expect(mergePluginData({ dismissedPromotableTargets: ['a', 1, 'b'] }).dismissedPromotableTargets).toEqual([
			'a',
			'b',
		]);
	});
});
