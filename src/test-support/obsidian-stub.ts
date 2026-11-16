/**
 * Test double for the `obsidian` package, which ships types only (no runtime
 * entry). `vitest.config.mts` aliases the module name to this file, so
 * adapter modules that import `TFile`, `Notice` or `parseFrontMatterAliases`
 * run unchanged under test.
 */

export class TFile {
	basename: string;
	extension: string;
	constructor(public path: string) {
		this.basename = path.replace(/\.[^.]+$/, '').split('/').pop() ?? path;
		this.extension = path.includes('.') ? (path.split('.').pop() ?? '') : '';
	}
}

/** Messages of every `Notice` shown since the last `clearNotices()`. */
export const notices: string[] = [];
export function clearNotices(): void {
	notices.length = 0;
}

export class Notice {
	constructor(message: string) {
		notices.push(message);
	}
}

export function parseFrontMatterAliases(fm: Record<string, unknown> | null | undefined): string[] | null {
	const value = fm?.aliases;
	if (typeof value === 'string') return [value];
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : null;
}
