import { DEFAULT_PROPERTY_KEYS, PropertyKeys, validatePropertyKey } from '../contract/frontmatter';

/** Persisted plugin data (loaded/saved via `Plugin.loadData`/`saveData`). */
export interface RedirectsPluginData {
	/** Normalized (see `normalizeKey`) unresolved-link targets the user has
	 * dismissed from the promotable-links cue (issue #6). */
	dismissedPromotableTargets: string[];
	/** Minimum distinct-source count before an unresolved link is promotable. */
	promotableThreshold: number;
	/** Vault-relative folders excluded from the promotable-links scan. */
	ignoredFolders: string[];
	/** Keys (see `collisionKey`) of heading/note collisions (issue #7) the
	 * user has already linked, registered as a local landing section, or
	 * dismissed — any of the three means "already handled". */
	handledHeadingCollisions: string[];
	/** Keys (`${filePath}::${term}`) of swallow-claim prompts (a duplicate
	 * claim's chooser, or an alias-conflict dialog) the user has dismissed —
	 * without this, cancelling doesn't stop the same prompt from reappearing
	 * on every subsequent save of that file. */
	dismissedSwallowPrompts: string[];
	/** When true (the default), a missing reciprocal `redirects-from` entry is
	 * added automatically after every save. Turning this off doesn't stop
	 * missing reciprocals from being detected — they still show in the
	 * health report with a one-click "Fix" action — it just stops the
	 * plugin from applying that fix on its own. */
	autoSyncReciprocals: boolean;
	/** Frontmatter property names for the stub's target and the canonical
	 * note's reciprocal list. Default to hyphenated names. */
	propertyKeys: PropertyKeys;
}

export const DEFAULT_PLUGIN_DATA: RedirectsPluginData = {
	dismissedPromotableTargets: [],
	promotableThreshold: 2,
	ignoredFolders: [],
	handledHeadingCollisions: [],
	dismissedSwallowPrompts: [],
	autoSyncReciprocals: true,
	propertyKeys: DEFAULT_PROPERTY_KEYS,
};

function mergePropertyKeys(value: unknown): PropertyKeys {
	const raw = (value ?? {}) as Partial<Record<keyof PropertyKeys, unknown>>;
	const redirectTo =
		typeof raw.redirectTo === 'string'
			? validatePropertyKey(raw.redirectTo, DEFAULT_PROPERTY_KEYS.redirectsFrom)
			: undefined;
	const redirectsFrom =
		typeof raw.redirectsFrom === 'string'
			? validatePropertyKey(raw.redirectsFrom, redirectTo ?? DEFAULT_PROPERTY_KEYS.redirectTo)
			: undefined;
	return {
		redirectTo: redirectTo ?? DEFAULT_PROPERTY_KEYS.redirectTo,
		redirectsFrom: redirectsFrom ?? DEFAULT_PROPERTY_KEYS.redirectsFrom,
	};
}

export function mergePluginData(loaded: unknown): RedirectsPluginData {
	const data = (loaded ?? {}) as Partial<RedirectsPluginData>;
	return {
		dismissedPromotableTargets: Array.isArray(data.dismissedPromotableTargets)
			? data.dismissedPromotableTargets.filter((v): v is string => typeof v === 'string')
			: DEFAULT_PLUGIN_DATA.dismissedPromotableTargets,
		promotableThreshold:
			typeof data.promotableThreshold === 'number' && data.promotableThreshold > 0
				? data.promotableThreshold
				: DEFAULT_PLUGIN_DATA.promotableThreshold,
		ignoredFolders: Array.isArray(data.ignoredFolders)
			? data.ignoredFolders.filter((v): v is string => typeof v === 'string')
			: DEFAULT_PLUGIN_DATA.ignoredFolders,
		handledHeadingCollisions: Array.isArray(data.handledHeadingCollisions)
			? data.handledHeadingCollisions.filter((v): v is string => typeof v === 'string')
			: DEFAULT_PLUGIN_DATA.handledHeadingCollisions,
		dismissedSwallowPrompts: Array.isArray(data.dismissedSwallowPrompts)
			? data.dismissedSwallowPrompts.filter((v): v is string => typeof v === 'string')
			: DEFAULT_PLUGIN_DATA.dismissedSwallowPrompts,
		autoSyncReciprocals:
			typeof data.autoSyncReciprocals === 'boolean'
				? data.autoSyncReciprocals
				: DEFAULT_PLUGIN_DATA.autoSyncReciprocals,
		propertyKeys: mergePropertyKeys(data.propertyKeys),
	};
}
