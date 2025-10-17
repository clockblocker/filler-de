import { describe, it, expect } from 'bun:test';
import {
	STAR,
	OBSIDIAN_LINK_OPEN,
	HASH,
	BIRD,
	PIPE,
	OBSIDIAN_LINK_CLOSE,
} from '../../src/types/beta/literals';
import {
	makeFormattedBacklinkToQuote,
	extractFormattedBacklinkToQuote,
} from '../../src/pure-formatters/quote-manager/functions/formatters/backlink-to-quote';

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

describe('makeFormattedBacklinkToQuote', () => {
	it('produces a backlink for typical inputs', () => {
		const fileName = 'My Note';
		const linkId = 123;
		const result = makeFormattedBacklinkToQuote({ fileName, linkId });
		expect(result).toBe(expectedBacklink(fileName, linkId) as any);
	});

	it('works with allowed punctuation in filename', () => {
		const fileName = 'Project (alpha) – draft';
		const linkId = 0;
		const result = makeFormattedBacklinkToQuote({ fileName, linkId });
		console.log('[makeFormattedBacklinkToQuote] result', result);
		expect(result).toBe(expectedBacklink(fileName, linkId) as any);
	});

	it('throws if required fields are missing', () => {
		// @ts-expect-error testing default runtime behavior
		expect(() => makeFormattedBacklinkToQuote({})).toThrow();
	});
});

describe('extractFormattedBacklinkToQuote', () => {
	it('parses a well-formed backlink', () => {
		const fileName = 'My Note';
		const linkId = 42;
		const formatted = expectedBacklink(fileName, linkId);
		const parsed = extractFormattedBacklinkToQuote(formatted);
		expect(parsed).toEqual({ fileName, linkId });
	});

	it('returns null for malformed input', () => {
		const bad = '*[[MissingParts]]*';
		expect(extractFormattedBacklinkToQuote(bad)).toBeNull();
	});

	it('rejects forbidden filename characters via schema', () => {
		const forbiddenNames = ['Name[bad]', 'Name]bad', 'Name|bad', 'Name#bad'];
		for (const name of forbiddenNames) {
			const formatted = expectedBacklink(name, 1);
			expect(extractFormattedBacklinkToQuote(formatted)).toBeNull();
		}
	});

	it('rejects non-numeric linkId', () => {
		const formatted =
			`${STAR}${OBSIDIAN_LINK_OPEN}` +
			`File${HASH}${BIRD}notANumber${PIPE}${BIRD}` +
			`${OBSIDIAN_LINK_CLOSE}${STAR}`;
		expect(extractFormattedBacklinkToQuote(formatted)).toBeNull();
	});
});
