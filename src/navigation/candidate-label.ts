import { ResolvedTarget } from '../registry/resolver';

/** Formats a disambiguation candidate for display: path, fragment, status. */
export function describeCandidate(item: ResolvedTarget): string {
	const { target } = item;
	let label = item.file?.path ?? target.path;
	if (target.heading) label += ` > ${target.heading}`;
	if (target.blockId) label += ` > ^${target.blockId}`;
	if (item.status !== 'resolved') label += ` — ${item.status}`;
	return label;
}
