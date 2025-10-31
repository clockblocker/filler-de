import { describe, expect, it } from 'bun:test';
import { makeTextsFromTree } from '../../../src/commanders/librarian/library-tree/helpers/serialization';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import { checkEqualityOfSerializedTexts } from '../../../src/commanders/librarian/pure-functions/serialized-text';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('texts === texts -> tree -> texts', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { texts } = branch;
		const tree = new LibraryTree(texts, 'Library');
		const otherTexts = makeTextsFromTree(tree);
		const expectedTexts = texts.map(t => ({ ...t, path: [tree.root.name, ...t.path] }));
		expect(checkEqualityOfSerializedTexts(expectedTexts, otherTexts)).toBe(true);
		}
	});
});

describe('texts -> nodes -> tree === nodes -> tree', () => {
	it('', () => {
		for (const [__name, branch] of Object.entries(VALID_BRANCHES)) {
			const { texts } = branch;
			const tree = new LibraryTree(texts, 'Library');

			const otherTree = new LibraryTree(texts, 'Library');
			const diff = tree.getDiff(otherTree);

			expect(diff).toEqual([]);
		}
	});
});
