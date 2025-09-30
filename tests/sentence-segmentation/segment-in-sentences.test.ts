import { describe, it, expect } from 'vitest';
import { toLinkedSegmentedSentences } from '../../src/pure-formatters/simple-text-processors/split-in-sentences';

const directMatches = [
	{
		name: 'With direct Speech',
		text: `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."
Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau.`,
		expected: ` Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: ^0

 "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." ^1

 Darauf tat sie die Augen zu und verschied. ^2

 Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut. ^3

 Als der Winter kam, deckte der Schnee ein weißes Tüchlein auf das Grab, und als die Sonne im Frühjahr es wieder herabgezogen hatte, nahm sich der Mann eine andere Frau. ^4\n`,
	},
];

describe('segmentInSentences', () => {
	for (const match of directMatches) {
		it(match.name, () => {
			const parts = toLinkedSegmentedSentences({
				selection: match.text,
				nameOfTheOpenendFile: 'Test File',
				highestBlockNumber: 0,
			});
			console.log(parts);
			expect(parts).toEqual(match.expected);
		});
	}
});
