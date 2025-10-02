import { describe, it, expect } from 'vitest';
import { segmentInQuotedLines } from '../../src/pure-formatters/quote-manager/split-in-sentences';

const directMatches = [
	{
		name: 'With direct Speech',
		text: `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."
Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.`,
		expected: [
			{
				fileName: 'Test File',
				linkId: 0,
				text: 'Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:',
			},
			{
				fileName: 'Test File',
				linkId: 1,
				text: '"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."',
			},
			{
				fileName: 'Test File',
				linkId: 2,
				text: 'Darauf tat sie die Augen zu und verschied.',
			},
			{
				fileName: 'Test File',
				linkId: 3,
				text: 'Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut.',
			},
			{
				fileName: 'Test File',
				linkId: 4,
				text: 'Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.',
			},
		],
	},
	{
		name: 'Already split',
		text: ` Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: ^0

 "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." ^1

 Darauf tat sie die Augen zu und verschied. ^2

 Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. ^3

 Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau. ^4`,
		expected: [
			{
				fileName: 'Test File',
				linkId: 0,
				text: 'Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:',
			},
			'',
			{
				fileName: 'Test File',
				linkId: 1,
				text: '"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."',
			},
			'',
			{
				fileName: 'Test File',
				linkId: 2,
				text: 'Darauf tat sie die Augen zu und verschied.',
			},
			'',
			{
				fileName: 'Test File',
				linkId: 3,
				text: 'Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut.',
			},
			'',
			{
				fileName: 'Test File',
				linkId: 4,
				text: 'Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.',
			},
		],
	},
];

describe('segmentInQuotedLines', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = segmentInQuotedLines({
				selection: match.text,
				nameOfTheOpenendFile: 'Test File',
				highestBlockNumber: 0,
			});
			console.log(parts);
			expect(parts).toEqual(match.expected);
		});
	}
});
