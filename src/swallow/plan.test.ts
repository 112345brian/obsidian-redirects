import { describe, expect, it } from 'vitest';
import { planSwallowRewrite } from './plan';

describe('planSwallowRewrite', () => {
	it('finds a bare link that was just closed at the cursor', () => {
		const line = 'See [[R package]] for details.';
		const cursorCh = 17; // right after the closing ]]
		expect(planSwallowRewrite(line, cursorCh, [line], 0)).toEqual({
			from: 4,
			to: 17,
			term: 'R package',
		});
	});

	it('does nothing when the cursor is not right after a closing ]]', () => {
		const line = 'See [[R package]] for details.';
		expect(planSwallowRewrite(line, line.length, [line], 0)).toBeUndefined();
	});

	it('does nothing mid-typing before the link is closed', () => {
		const line = 'See [[R package';
		expect(planSwallowRewrite(line, line.length, [line], 0)).toBeUndefined();
	});

	it('does nothing inside a fenced code block', () => {
		const lines = ['```', 'See [[R package]]', '```'];
		expect(planSwallowRewrite(lines[1]!, 17, lines, 1)).toBeUndefined();
	});

	it('ignores an aliased or fragmented link even at the cursor', () => {
		const line = '[[R package|pkg]]';
		expect(planSwallowRewrite(line, line.length, [line], 0)).toBeUndefined();
	});
});
