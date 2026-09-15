import { WikilinkTarget } from '../contract/wikilink';
import { ResolvedTarget } from './resolver';
import { VaultNoteFile } from './types';

export interface RedirectEntry {
	file: VaultNoteFile;
	resolved: ResolvedTarget;
}

export interface DisambiguationEntry {
	file: VaultNoteFile;
	candidates: ResolvedTarget[];
}

export interface ReciprocalClaim {
	/** The note declaring `redirects_from`. */
	claimant: VaultNoteFile;
	target: WikilinkTarget;
	resolved: ResolvedTarget;
}

/** The registry's built-but-unvalidated index, consumed by the health checks. */
export interface RegistryState {
	redirects: Map<string, RedirectEntry>;
	disambiguations: Map<string, DisambiguationEntry>;
	reciprocalClaims: Map<string, ReciprocalClaim[]>;
}

/**
 * Key a reciprocal claim by the file it actually names, whenever one was
 * found — a resolved-but-wrong-fragment target (e.g. a missing heading)
 * still identifies a real file, so it must key the same way a stub redirect
 * to that file would. Only a genuinely unresolved or ambiguous name falls
 * back to the raw target text.
 */
export function claimKey(resolved: ResolvedTarget, fallback: WikilinkTarget): string {
	if (resolved.file) {
		return pathClaimKey(resolved.file.path);
	}
	return `unresolved:${fallback.path.toLowerCase()}`;
}

export function pathClaimKey(path: string): string {
	return `path:${path.toLowerCase()}`;
}
