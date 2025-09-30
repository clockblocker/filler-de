import { describe, it, expect } from 'vitest';
import {
	makeBacklinkToQuote,
	parseBacklinkToQuote,
} from '../../src/pure-formatters/quote-manager/backlink-to-quote';
import {
	STAR,
	OBSIDIAN_LINK_OPEN,
	HASH,
	BIRD,
	PIPE,
	OBSIDIAN_LINK_CLOSE,
} from '../../src/types/beta/literals';

function expectedBacklink(fileName: string, linkId: string | number): string {
	return (
		`${STAR}` +
		`${OBSIDIAN_LINK_OPEN}` +
		`${fileName}` +
		`${HASH}${BIRD}${linkId}` +
		`${PIPE}${BIRD}` +
		`${OBSIDIAN_LINK_CLOSE}` +
		`${STAR}`
	);
}

describe('makeBacklinkToQuote', () => {
	it('produces a backlink for typical inputs', () => {
		const fileName = 'My Note';
		const linkId = 123;
		const result = makeBacklinkToQuote({ fileName, linkId });
		expect(result).toBe(expectedBacklink(fileName, linkId));
	});

	it('works with allowed punctuation in filename', () => {
		const fileName = 'Project (alpha) – draft';
		const linkId = 0;
		const result = makeBacklinkToQuote({ fileName, linkId });
		expect(result).toBe(expectedBacklink(fileName, linkId));
	});

	it('falls back to empty parts if fields missing', () => {
		// @ts-expect-error testing runtime fallback behavior
		const result = makeBacklinkToQuote({});
		expect(result).toBe(expectedBacklink('', ''));
	});
});

describe('parseBacklinkToQuote', () => {
	it('parses a well-formed backlink', () => {
		const fileName = 'My Note';
		const linkId = 42;
		const formatted = expectedBacklink(fileName, linkId);
		const parsed = parseBacklinkToQuote(formatted);
		expect(parsed).toEqual({ fileName, linkId });
	});

	it('returns null for malformed input', () => {
		const bad = '*[[MissingParts]]*';
		expect(parseBacklinkToQuote(bad)).toBeNull();
	});

	it('rejects forbidden filename characters via schema', () => {
		const forbiddenNames = ['Name[bad]', 'Name]bad', 'Name|bad', 'Name#bad'];
		for (const name of forbiddenNames) {
			const formatted = expectedBacklink(name, 1);
			expect(parseBacklinkToQuote(formatted)).toBeNull();
		}
	});

	it('rejects non-numeric linkId', () => {
		const formatted =
			`${STAR}${OBSIDIAN_LINK_OPEN}` +
			`File${HASH}${BIRD}notANumber${PIPE}${BIRD}` +
			`${OBSIDIAN_LINK_CLOSE}${STAR}`;
		expect(parseBacklinkToQuote(formatted)).toBeNull();
	});
});
