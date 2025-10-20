import { describe, it, expect } from 'bun:test';
import {
	makeTextsFromTree,
	makeTreeFromTexts,
} from '../../../src/currator/currated-tree/helpers/serialization';
import { logToFile } from '../../tracing/functions/write-log-to-file';
import { AVATAR_TEXTS } from '../static/battaries/avatar';

describe('CurratedTree - add and remove all texts cycle', () => {
	it('can remove and re-add every text and result is identical', () => {
		// Step 1: create tree from AVATAR_TEXTS
		const initialTree = makeTreeFromTexts(AVATAR_TEXTS);

		// Step 2: remove every text from tree, iterating by AVATAR_TEXTS
		for (const text of AVATAR_TEXTS) {
			initialTree.deleteText({ path: text.path });
		}
		// Tree is now empty except root

		// Step 3: add text to tree, iterating by AVATAR_TEXTS
		for (const text of AVATAR_TEXTS) {
			initialTree.addText(text);
		}

		// Step 4: compare the resulting tree to freshly-created one from AVATAR_TEXTS
		const refilledTree = makeTreeFromTexts(AVATAR_TEXTS);

		// We compare the texts representations for equality
		const currTexts = makeTextsFromTree(initialTree);
		const refilledTexts = makeTextsFromTree(refilledTree);

		logToFile('currTexts.json', JSON.stringify(currTexts, null, 2));
		logToFile('refilledTexts.json', JSON.stringify(refilledTexts, null, 2));

		expect(currTexts).toEqual(refilledTexts);
	});
});
