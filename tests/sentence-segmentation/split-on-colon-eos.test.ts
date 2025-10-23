import { describe, expect, it } from 'bun:test';
import { splitOnDoubleColon } from '../../src/services/dto-services/quote-manager/functions/splitters/split-on-colon';

const directMatches = [
	{
		expected: [
			'Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:',
			'"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."',
		],
		name: 'Direct speech is split',
		text: `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."`,
	},
	{
		expected: [
			'Aber sie sprach:',
			'"Nein, Aschenputtel, du hast keine Kleider, und kannst nicht tanzen: du wirst nur ausgelacht."',
		],
		name: 'Direct speech is split. : inside is left as is',
		text: `Aber sie sprach: "Nein, Aschenputtel, du hast keine Kleider, und kannst nicht tanzen: du wirst nur ausgelacht."`,
	},
];

describe('segmentWithColonPrepass', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = splitOnDoubleColon(match.text);
			expect(parts).toEqual(match.expected);
		});
	}
});
