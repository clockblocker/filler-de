import { describe, expect, it } from 'bun:test';
import {
	extractFormattedLinkedQuote,
	makeFormattedLinkedQuote,
} from '../../../src/deprecated-services/dto-services/quote-manager/functions/formatters/linked-quote';
import { BIRD } from '../../../src/types/literals';

function expected(text: string, linkId: string | number): string {
	return ` ${text} ${BIRD}${linkId}\n`;
}

describe('makeFormattedLinkedQuote', () => {
	it('formats text with link id', () => {
		const text = 'Hello world.';
		const linkId = 7;
		const result = makeFormattedLinkedQuote({ linkId, text });
		expect(result).toBe(expected(text, linkId));
	});

	it('keeps trailing spaces/newlines in text', () => {
		const text = 'Line with spaces  \n';
		const linkId = 3;
		const result = makeFormattedLinkedQuote({ linkId, text });
		expect(result).toBe(expected(text, linkId));
	});
});

describe('parseFormattedLinkedQuote', () => {
	it('parses well-formed input', () => {
		const text = 'A sentence.';
		const linkId = 101;
		const formatted = expected(text, linkId);
		const parsed = extractFormattedLinkedQuote(formatted);
		expect(parsed).toEqual({ linkId, text });
	});

	it('returns null for empty text part', () => {
		const formatted = expected('', 1);
		expect(extractFormattedLinkedQuote(formatted)).toBeNull();
	});

	it('returns null when linkId is not numeric', () => {
		const formatted = expected('Some text', 'NaN');
		expect(extractFormattedLinkedQuote(formatted)).toBeNull();
	});

	it('handles multiline text', () => {
		const text = 'Line 1\nLine 2\nLine 3';
		const linkId = 55;
		const formatted = expected(text, linkId);
		const parsed = extractFormattedLinkedQuote(formatted);
		expect(parsed).toEqual({ linkId, text });
	});
});
