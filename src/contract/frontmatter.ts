/**
 * The redirect/disambiguation contract (issue #1): parses the three
 * frontmatter properties this plugin defines. Values must be native
 * wikilinks so Obsidian's own renamer keeps them in sync.
 *
 *   redirect_to:    "[[Canonical note#Heading]]"   (single wikilink)
 *   redirects_from:
 *     - "[[Old name]]"                              (list of wikilinks)
 *   disambiguates:
 *     - "[[Candidate A]]"                           (list of wikilinks)
 *
 * `redirect_to` is the source of truth for where a stub points.
 * `redirects_from` is a reciprocal declaration used only for indexing and
 * validation — the registry (issue #2) treats a mismatch as a warning, not
 * an error, and never rewrites files.
 */

import { parseWikilink, WikilinkTarget } from './wikilink';

export const REDIRECT_TO_KEY = 'redirect_to';
export const REDIRECTS_FROM_KEY = 'redirects_from';
export const DISAMBIGUATES_KEY = 'disambiguates';

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
): ParsedContract {
	const issues: ContractIssue[] = [];
	const result: ParsedContract = {
		redirectsFrom: [],
		disambiguates: [],
		issues,
	};

	if (!frontmatter) return result;

	if (REDIRECT_TO_KEY in frontmatter) {
		const target = parseSingleWikilinkProperty(
			REDIRECT_TO_KEY,
			frontmatter[REDIRECT_TO_KEY],
			issues,
		);
		if (target) result.redirectTo = target;
	}

	if (REDIRECTS_FROM_KEY in frontmatter) {
		result.redirectsFrom = parseWikilinkListProperty(
			REDIRECTS_FROM_KEY,
			frontmatter[REDIRECTS_FROM_KEY],
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

	return result;
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
