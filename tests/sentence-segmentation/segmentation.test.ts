import { describe, it, expect } from 'vitest';
import { splitOnColonEOS } from '../../src/simple-text-processors/split-in-sentences';

describe('segmentWithColonPrepass', () => {
	const text = `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach: "Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."`;

	const expected = [
		'Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:',
		'"Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein."',
	];

	it(`Direct speach is split. " as quotation mark`, () => {
		const parts = splitOnColonEOS(text);
		expect(parts).toEqual(expected);
	});
});
