import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import { checkEqualityOfSerializedTexts } from '../../../src/commanders/librarian/pure-functions/serialized-text';
import { TextStatus } from '../../../src/types/common-interface/enums';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('Explict testing of all methods ', () => {
	it('Basic operations on new tree', () => {
		const tree = new LibraryTree([], 'Library');
		expect(tree.getAllTextsInTree()).toEqual([]);

		tree.addText({
			pageStatuses: { 'Text': TextStatus.NotStarted },
			path: ['Section', 'Text'],
		});
		// For ScrollNodes, serialization uses the node name as the page name
		expect(tree.getAllTextsInTree()).toEqual([
			{ pageStatuses: { 'Text': TextStatus.NotStarted }, path: ['Section', 'Text'] },
		]);

		tree.deleteText({ path: ['Section', 'Text'] });
		expect(tree.getAllTextsInTree()).toEqual([]);
	});

	it('Basic operations on deep tree', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTextsInTree(),
				VALID_BRANCHES.Avatar.texts
			)
		).toBe(true);

		tree.deleteText({ path: ['Avatar', 'Season_1', 'Episode_1'] });
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTextsInTree(),
				VALID_BRANCHES.Avatar.texts.filter(
					(text) => text.path.join('-') !== 'Avatar-Season_1-Episode_1'
				)
			)
		).toBe(true);

		tree.addText({
			pageStatuses: { 'Episode_1': TextStatus.NotStarted },
			path: ['Avatar', 'Season_1', 'Episode_1'],
		});
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTextsInTree(),
				VALID_BRANCHES.Avatar.texts
			)
		).toBe(true);
	});
});
