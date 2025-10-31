import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import {
	type SerializedText,
	type TreePath,
} from '../../../src/commanders/librarian/types';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('CurratedTree - deleteText', () => {
	it('should delete existing text (Intro) from root', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		// Confirm node exists
		const foundBefore = tree.getMaybeNode({
			path: ['Intro'] as TreePath,
		});
		expect(foundBefore.error).toBe(false);

		tree.deleteText({ path: ['Intro'] as TreePath });

		const foundAfter = tree.getMaybeNode({
			path: ['Intro'] as TreePath,
		});
		expect(foundAfter.error).toBe(true);
	});

	it('should delete nested text ("Avatar" -> "Season_1" -> "Episode_1")', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const foundBefore = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
		});
		expect(foundBefore.error).toBe(false);

		tree.deleteText({ path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath });

		const foundAfter = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
		});
		expect(foundAfter.error).toBe(true);

		// Should not delete parent sections
		expect(
			tree.getMaybeNode({ path: ['Avatar', 'Season_1'] as TreePath }).error
		).toBe(false);
	});

	it('should do nothing when deleting non-existent text (wrong root child)', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		tree.deleteText({ path: ['NotARealThing'] as TreePath });
		// Should not throw or change tree
		expect(
			tree.getMaybeNode({ path: ['NotARealThing'] as TreePath }).error
		).toBe(true);
		// Existing node still present
		expect(tree.getMaybeNode({ path: ['Intro'] as TreePath }).error).toBe(
			false
		);
	});

	it('should do nothing when deleting non-existent deeply nested text', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		tree.deleteText({ path: ['Avatar', 'Season_2', 'Episode_9'] as TreePath });
		expect(
			tree.getMaybeNode({
				path: ['Avatar', 'Season_2', 'Episode_9'] as TreePath,
			}).error
		).toBe(true);
		expect(
			tree.getMaybeNode({ path: ['Avatar', 'Season_2'] as TreePath }).error
		).toBe(false);
	});

	it('should remove empty section nodes up the chain after deleting last child text', () => {
		// We create a tree with a nested structure and just one deep text
		const texts: SerializedText[] = [
			{
				pageStatuses: {},
				path: ['A', 'B', 'C'] as TreePath,
			},
		];
		const tree = new LibraryTree(texts, 'Library');
		expect(tree.getMaybeNode({ path: ['A', 'B', 'C'] as TreePath }).error).toBe(
			false
		);

		tree.deleteText({ path: ['A', 'B', 'C'] as TreePath });

		// All chain gone except root ("A" and "B" should be deleted too)
		expect(tree.getMaybeNode({ path: ['A', 'B', 'C'] as TreePath }).error).toBe(
			true
		);
		expect(tree.getMaybeNode({ path: ['A', 'B'] as TreePath }).error).toBe(
			true
		);
		expect(tree.getMaybeNode({ path: ['A'] as TreePath }).error).toBe(true);
	});
});
