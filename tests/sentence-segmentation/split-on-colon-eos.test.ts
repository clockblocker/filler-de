import { describe, it, expect } from 'vitest';
import { splitOnColonEOS } from '../../src/pure-formatters/simple-text-processors/split-in-sentences';

const directMatches = [
	{
		name: 'Direct speech is split',
		text: `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."`,
		expected: [
			'Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:',
			'"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."',
		],
	},
	{
		name: 'Direct speech is split. : inside is left as is',
		text: `Aber sie sprach: "Nein, Aschenputtel, du hast keine Kleider, und kannst nicht tanzen: du wirst nur ausgelacht."`,
		expected: [
			'Aber sie sprach:',
			'"Nein, Aschenputtel, du hast keine Kleider, und kannst nicht tanzen: du wirst nur ausgelacht."',
		],
	},
];

describe('segmentWithColonPrepass', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = splitOnColonEOS(match.text);
			expect(parts).toEqual(match.expected);
		});
	}
});
