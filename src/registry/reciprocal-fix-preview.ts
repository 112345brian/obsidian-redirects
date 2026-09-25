import { REDIRECTS_FROM_KEY } from '../contract/frontmatter';
import { HealthIssue } from './health';

/** Preview lines for a missing/stale reciprocal fix, shown before applying. */
export function reciprocalFixPreview(issue: HealthIssue): string[] {
	const related = issue.related?.[0] ?? '';
	return issue.type === 'missing-reciprocal'
		? [`Add to "${issue.path}":`, `  ${REDIRECTS_FROM_KEY}: [..., "[[${related.replace(/\.md$/i, '')}]]"]`]
		: [`Remove from "${issue.path}":`, `  ${REDIRECTS_FROM_KEY}: "${related}"`];
}
