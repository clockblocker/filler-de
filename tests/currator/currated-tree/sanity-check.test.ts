import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import { checkEqualityOfSerializedTexts } from '../../../src/managers/currator/pure-functions/serialized-text';
import {
	NodeStatus,
} from '../../../src/managers/currator/types';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('Explict testing of all methods ', () => {
	it('Basic operations on new tree', () => {
		const tree = new CurratedTree([], 'Library');
		expect(tree.getAllTexts()).toEqual([]);

		tree.addText({
			pageStatuses: [NodeStatus.NotStarted],
			path: ['Section', 'Text'],
		});
		expect(tree.getAllTexts()).toEqual([
			{ pageStatuses: [NodeStatus.NotStarted], path: ['Section', 'Text'] },
		]);

		tree.deleteText({ path: ['Section', 'Text'] });
		expect(tree.getAllTexts()).toEqual([]);
	});

	it('Basic operations on deep tree', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTexts(),
				VALID_BRANCHES.Avatar.texts
			)
		).toBe(true);

		tree.deleteText({ path: ['Avatar', 'Season_1', 'Episode_1'] });
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTexts(),
				VALID_BRANCHES.Avatar.texts.filter(
					(text) => text.path.join('-') !== 'Avatar-Season_1-Episode_1'
				)
			)
		).toBe(true);

		tree.addText({
			pageStatuses: [NodeStatus.NotStarted],
			path: ['Avatar', 'Season_1', 'Episode_1'],
		});
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTexts(),
				VALID_BRANCHES.Avatar.texts
			)
		).toBe(true);
	});
});
