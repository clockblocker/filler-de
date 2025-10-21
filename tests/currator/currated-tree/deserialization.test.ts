import { describe, expect, it } from 'bun:test';

import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import { makeTextsFromTree } from '../../../src/managers/currator/currated-tree/helpers/serialization';
import { checkEqualityOfSerializedTexts } from '../../../src/managers/currator/pure-functions/serialized-text';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('texts === texts -> tree -> texts', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { texts } = branch;
			const tree = new CurratedTree(texts, 'Library');
			const otherTexts = makeTextsFromTree(tree);
			expect(checkEqualityOfSerializedTexts(texts, otherTexts)).toBe(true);
		}
	});
});

describe('texts -> nodes -> tree === nodes -> tree', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { texts } = branch;
			const tree = new CurratedTree(texts, 'Library');

			const otherTree = new CurratedTree(texts, 'Library');
			const diff = tree.getDiff(otherTree);

			expect(diff).toEqual([]);
		}
	});
});
