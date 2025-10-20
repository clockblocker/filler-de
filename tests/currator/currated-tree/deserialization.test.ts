import { describe, it, expect } from 'bun:test';

import { CurratedTree } from '../../../src/currator/currated-tree/currated-tree';
import {
	makeTextsFromTree,
	makeTreeFromTexts,
} from '../../../src/currator/currated-tree/helpers/serialization';
import { checkEqualityOfSerializedTexts } from '../../../src/currator/pure-functions/serialized-text';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('texts === texts -> tree -> texts', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = new CurratedTree(nodes, 'Library');
			const otherTexts = makeTextsFromTree(tree);
			expect(checkEqualityOfSerializedTexts(texts, otherTexts)).toBe(true);
		}
	});
});

describe('texts -> nodes -> tree === nodes -> tree', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = makeTreeFromTexts(texts);

			const otherTree = new CurratedTree(nodes, 'Library');
			const diff = tree.getDiff(otherTree);

			expect(diff).toEqual([]);
		}
	});
});
