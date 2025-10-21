import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/currator/currated-tree/currated-tree';
import {
	NodeStatus,
	type SerializedText,
} from '../../../src/currator/currator-types';
import { VALID_BRANCHES } from '../static/defined-branches';
import { checkEqualityOfSerializedTexts } from '../../../src/currator/pure-functions/serialized-text';

describe('Explict testing of all methods ', () => {
	it('Basic operations on new tree', () => {
		const tree = new CurratedTree([], 'Library');
		expect(tree.getAllTexts()).toEqual([]);

		tree.addText({
			path: ['Section', 'Text'],
			pageStatuses: [NodeStatus.NotStarted],
		});
		expect(tree.getAllTexts()).toEqual([
			{ path: ['Section', 'Text'], pageStatuses: [NodeStatus.NotStarted] },
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
			path: ['Avatar', 'Season_1', 'Episode_1'],
			pageStatuses: [NodeStatus.NotStarted],
		});
		expect(
			checkEqualityOfSerializedTexts(
				tree.getAllTexts(),
				VALID_BRANCHES.Avatar.texts
			)
		).toBe(true);
	});
});
