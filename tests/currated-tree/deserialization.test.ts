import { describe, it, expect } from 'bun:test';

import { DEFINED_BRANCHES } from './static/defined-branches';
import { CurratedTree } from '../../src/currator/currated-tree/currated-tree';
import {
	makeTextsFromTree,
	makeTreeFromTexts,
} from '../../src/currator/currated-tree/serialization';
import { checkEqualityOfSerializedTexts } from '../../src/currator/pure-functions/serialized-text';
import { logToFile } from '../tracing/functions/write-log-to-file';

describe('texts -> nodes -> tree === nodes -> tree', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(DEFINED_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = makeTreeFromTexts(texts);

			const otherTree = new CurratedTree(nodes, 'Library');
			const diff = tree.getDiff(otherTree);

			expect(diff).toEqual([]);
		}
	});
});

describe('texts === texts -> tree -> texts', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(DEFINED_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = new CurratedTree(nodes, 'Library');
			const otherTexts = makeTextsFromTree(tree);
			expect(checkEqualityOfSerializedTexts(texts, otherTexts)).toBe(true);
		}
	});
});
