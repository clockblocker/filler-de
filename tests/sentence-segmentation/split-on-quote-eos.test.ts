import { describe, it, expect } from 'bun:test';
import { splitOnQuote } from '../../src/pure-formatters/quote-manager/functions/splitters/split-on-quote';

const directMatches = [
	{
		name: '..!" Sie ...',
		text: `"Soll die dumme Gans bei uns in der Stube sitzen!" sprachen sie, "wer Brot essen will, muß verdienen: hinaus mit der Küchenmagd!" Sie nahmen ihm seine schönen Kleider weg, zogen ihm einen grauen, alten Kittel an und gaben ihm hölzerne Schuhe.`,
		expected: [
			`"Soll die dumme Gans bei uns in der Stube sitzen!" sprachen sie, "wer Brot essen will, muß verdienen: hinaus mit der Küchenmagd!"`,
			`Sie nahmen ihm seine schönen Kleider weg, zogen ihm einen grauen, alten Kittel an und gaben ihm hölzerne Schuhe.`,
		],
	},
	{
		name: 'Ach nein, das ist viel zu schmutzig, das darf sich nicht sehen lassen. Er wollte es aber durchaus haben, und Aschenputtel musste gerufen werden.',
		text: `"Ach nein, das ist viel zu schmutzig, das darf sich nicht sehen lassen." Er wollte es aber durchaus haben, und Aschenputtel musste gerufen werden.`,
		expected: [
			`"Ach nein, das ist viel zu schmutzig, das darf sich nicht sehen lassen."`,
			`Er wollte es aber durchaus haben, und Aschenputtel musste gerufen werden.`,
		],
	},
];

describe('splitOnQuoteEOS', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = splitOnQuote(match.text);
			expect(parts).toEqual(match.expected);
		});
	}
});
