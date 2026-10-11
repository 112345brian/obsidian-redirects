/**
 * The redirect/disambiguation contract (issue #1): parses the three
 * frontmatter properties this plugin defines. Values must be native
 * wikilinks so Obsidian's own renamer keeps them in sync.
 *
 *   redirect-to:    "[[Canonical note#Heading]]"   (single wikilink)
 *   redirects-from:
 *     - "[[Old name]]"                              (list of wikilinks)
 *   disambiguates:
 *     - "[[Candidate A]]"                           (list of wikilinks)
 *   swallows:
 *     - "R package"                                 (list of literal terms)
 *
 * `redirect-to` is the source of truth for where a stub points.
 * `redirects-from` is a reciprocal declaration used only for indexing and
 * validation — the registry (issue #2) treats a mismatch as a warning, not
 * an error, and never rewrites files. `swallows` (issue #10) is different in
 * kind: its entries are literal display terms a canonical note claims, not
 * wikilinks — an unqualified `[[term]]` written elsewhere gets path-qualified
 * at authoring time, never a stub or disambiguation page's own property.
 */

import { parseWikilink, WikilinkTarget } from './wikilink';

/** The two property names the user may rename in settings. The other two
 * (`disambiguates`, `swallows`) are fixed. */
export interface PropertyKeys {
	redirectTo: string;
	redirectsFrom: string;
}

export const DEFAULT_PROPERTY_KEYS: PropertyKeys = {
	redirectTo: 'redirect-to',
	redirectsFrom: 'redirects-from',
};
export const DISAMBIGUATES_KEY = 'disambiguates';
export const SWALLOWS_KEY = 'swallows';

let activeKeys: PropertyKeys = DEFAULT_PROPERTY_KEYS;

/** Sets the property names used everywhere a caller doesn't pass its own. */
export function setPropertyKeys(keys: PropertyKeys): void {
	activeKeys = { ...keys };
}

export function getPropertyKeys(): PropertyKeys {
	return activeKeys;
}

export function redirectToKey(): string {
	return activeKeys.redirectTo;
}

export function redirectsFromKey(): string {
	return activeKeys.redirectsFrom;
}

/** Returns the trimmed name if it is usable as a frontmatter property that
 * doesn't collide with another contract property, else undefined. */
export function validatePropertyKey(
	value: string,
	otherKey: string,
): string | undefined {
	const trimmed = value.trim();
	if (!trimmed || /[\s:#[\]{}"',]/.test(trimmed)) return undefined;
	const lower = trimmed.toLowerCase();
	const reserved = [DISAMBIGUATES_KEY, SWALLOWS_KEY, otherKey.toLowerCase()];
	return reserved.includes(lower) ? undefined : trimmed;
}

export type ContractIssueCode =
	| 'not-a-string'
	| 'not-a-list'
	| 'empty-value'
	| 'malformed-wikilink';

export interface ContractIssue {
	property: string;
	code: ContractIssueCode;
	message: string;
	/** Index into the source list, when the property is a list. */
	index?: number;
	value: unknown;
}

export interface ParsedContract {
	redirectTo?: WikilinkTarget;
	redirectsFrom: WikilinkTarget[];
	disambiguates: WikilinkTarget[];
	/** Literal display terms this note claims (issue #10) — plain strings,
	 * not wikilinks, since a swallow claim owns an unqualified display term
	 * rather than pointing at a target. */
	swallows: string[];
	issues: ContractIssue[];
}

/**
 * Parses the redirect-related frontmatter of a single note. Frontmatter is
 * expected in the shape Obsidian's metadata cache exposes it
 * (`CachedMetadata['frontmatter']`): a plain object of already-YAML-parsed
 * values. Unknown/absent properties are simply omitted from the result.
 */
export function parseContract(
	frontmatter: Record<string, unknown> | undefined | null,
	keys: PropertyKeys = activeKeys,
): ParsedContract {
	const issues: ContractIssue[] = [];
	const result: ParsedContract = {
		redirectsFrom: [],
		disambiguates: [],
		swallows: [],
		issues,
	};

	if (!frontmatter) return result;

	if (keys.redirectTo in frontmatter) {
		const target = parseSingleWikilinkProperty(
			keys.redirectTo,
			frontmatter[keys.redirectTo],
			issues,
		);
		if (target) result.redirectTo = target;
	}

	if (keys.redirectsFrom in frontmatter) {
		result.redirectsFrom = parseWikilinkListProperty(
			keys.redirectsFrom,
			frontmatter[keys.redirectsFrom],
			issues,
		);
	}

	if (DISAMBIGUATES_KEY in frontmatter) {
		result.disambiguates = parseWikilinkListProperty(
			DISAMBIGUATES_KEY,
			frontmatter[DISAMBIGUATES_KEY],
			issues,
		);
	}

	if (SWALLOWS_KEY in frontmatter) {
		result.swallows = parseStringListProperty(SWALLOWS_KEY, frontmatter[SWALLOWS_KEY], issues);
	}

	return result;
}

function parseStringListProperty(
	property: string,
	value: unknown,
	issues: ContractIssue[],
): string[] {
	if (!Array.isArray(value)) {
		issues.push({
			property,
			code: 'not-a-list',
			message: `"${property}" must be a list of literal display-term strings.`,
			value,
		});
		return [];
	}

	const terms: string[] = [];
	value.forEach((entry, index) => {
		if (typeof entry !== 'string') {
			issues.push({
				property,
				code: 'not-a-string',
				message: `"${property}[${index}]" must be a string.`,
				index,
				value: entry,
			});
			return;
		}
		const trimmed = entry.trim();
		if (!trimmed) {
			issues.push({
				property,
				code: 'empty-value',
				message: `"${property}[${index}]" is empty.`,
				index,
				value: entry,
			});
			return;
		}
		terms.push(trimmed);
	});

	return terms;
}

function parseSingleWikilinkProperty(
	property: string,
	value: unknown,
	issues: ContractIssue[],
): WikilinkTarget | undefined {
	if (typeof value !== 'string') {
		issues.push({
			property,
			code: 'not-a-string',
			message: `"${property}" must be a single quoted wikilink string.`,
			value,
		});
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		issues.push({
			property,
			code: 'empty-value',
			message: `"${property}" is empty.`,
			value,
		});
		return undefined;
	}

	const target = parseWikilink(trimmed);
	if (!target) {
		issues.push({
			property,
			code: 'malformed-wikilink',
			message: `"${property}" value "${trimmed}" is not a valid [[wikilink]].`,
			value,
		});
		return undefined;
	}

	return target;
}

function parseWikilinkListProperty(
	property: string,
	value: unknown,
	issues: ContractIssue[],
): WikilinkTarget[] {
	if (!Array.isArray(value)) {
		issues.push({
			property,
			code: 'not-a-list',
			message: `"${property}" must be a list of quoted wikilink strings.`,
			value,
		});
		return [];
	}

	const targets: WikilinkTarget[] = [];
	value.forEach((entry, index) => {
		if (typeof entry !== 'string') {
			issues.push({
				property,
				code: 'not-a-string',
				message: `"${property}[${index}]" must be a quoted wikilink string.`,
				index,
				value: entry,
			});
			return;
		}
		const trimmed = entry.trim();
		if (!trimmed) {
			issues.push({
				property,
				code: 'empty-value',
				message: `"${property}[${index}]" is empty.`,
				index,
				value: entry,
			});
			return;
		}
		const target = parseWikilink(trimmed);
		if (!target) {
			issues.push({
				property,
				code: 'malformed-wikilink',
				message: `"${property}[${index}]" value "${trimmed}" is not a valid [[wikilink]].`,
				index,
				value: entry,
			});
			return;
		}
		targets.push(target);
	});

	return targets;
}
