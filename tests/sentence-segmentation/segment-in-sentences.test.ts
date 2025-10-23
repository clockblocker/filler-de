import { describe, expect, it } from 'bun:test';
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from '../../src/services/dto-services/quote-manager/interface';

const directMatches = [
	{
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
		name: 'With direct Speech',
		text: `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."
Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.`,
	},
	{
		expected: [
			'###### **ANNA:**',
			{
				fileName: 'Test File',
				linkId: 0,
				text: 'Louis komm schon. Sascha! Die [[Post]]!',
			},
			{
				fileName: 'Test File',
				linkId: 1,
				text: 'Louis und ich haben die Post!',
			},
			{
				fileName: 'Test File',
				linkId: 2,
				text: 'Gib mir die Post Louis!',
			},
			'',
			'###### **SASCHA:** ',
			{
				fileName: 'Test File',
				linkId: 3,
				text: 'Gib mir sofort die Post Louis!',
			},
			'',
			'###### **ANNA:**',
			{
				fileName: 'Test File',
				linkId: 4,
				text: 'Louis. Lass das fallen!',
			},
			'',
			'###### **ANNA:**',
			{
				fileName: 'Test File',
				linkId: 5,
				text: 'Guter Hund!',
			},
			'',
		],
		name: 'Dialog with hashes',
		text: `###### **ANNA:**
Louis komm schon. Sascha! Die [[Post]]! Louis und ich haben die Post!  
Gib mir die Post Louis!

###### **SASCHA:** 
Gib mir sofort die Post Louis!

###### **ANNA:**
Louis. Lass das fallen!

###### **ANNA:**
Guter Hund!
`,
	},
];

describe('segmentInQuotedLines matches expected', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = segmentInQuotedLines({
				highestBlockNumber: 0,
				nameOfTheOpenendFile: 'Test File',
				text: match.text,
			});

			console.log(parts);

			expect(parts).toEqual(match.expected);
		});
	}
});

describe('segmentInQuotedLines is idempotent', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = segmentInQuotedLines({
				highestBlockNumber: 0,
				nameOfTheOpenendFile: 'Test File',
				text: match.text,
			});

			const firstFormatted = formatQuotedLines(parts);

			const parts2 = segmentInQuotedLines({
				highestBlockNumber: 0,
				nameOfTheOpenendFile: 'Test File',
				text: firstFormatted,
			});

			expect(parts).toEqual(parts2);
		});
	}
});

// describe('formatQuotedLines is idempotent', () => {
// 	for (const match of directMatches) {
// 		it(match.name, () => {
// 			const parts = segmentInQuotedLines({
// 				text: match.text,
// 				nameOfTheOpenendFile: 'Test File',
// 				highestBlockNumber: 0,
// 			});
// 			const firstFormatted = formatQuotedLines(parts);
// 			const secondFormatted = formatQuotedLines(
// 				segmentInQuotedLines({
// 					text: firstFormatted,
// 					nameOfTheOpenendFile: 'Test File',
// 					highestBlockNumber: 0,
// 				})
// 			);
// 			expect(firstFormatted).toEqual(secondFormatted);
// 		});
// 	}
// });
