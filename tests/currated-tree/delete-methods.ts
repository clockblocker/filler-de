import { describe, it, expect } from 'bun:test';
import { CurratedTree } from '../../src/currator/currated-tree/currated-tree';
import { VALID_BRANCHES } from './static/defined-branches';

const avatarNodes = VALID_BRANCHES.Avatar.nodes;

describe('CurratedTree - deleteText', () => {
	it('should delete existing text (Intro) from root', () => {
		const tree = new CurratedTree(
			JSON.parse(JSON.stringify(avatarNodes)),
			'Library'
		);
		// Confirm node exists
		const foundBefore = tree.getMaybeNode({ path: ['Intro'] });
		expect(foundBefore.error).toBe(false);

		tree.deleteText({ path: ['Intro'] });

		const foundAfter = tree.getMaybeNode({ path: ['Intro'] });
		expect(foundAfter.error).toBe(true);
	});

	it('should delete nested text ("Avatar" -> "Season_1" -> "Episode_1")', () => {
		const tree = new CurratedTree(
			JSON.parse(JSON.stringify(avatarNodes)),
			'Library'
		);
		const foundBefore = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'],
		});
		expect(foundBefore.error).toBe(false);

		tree.deleteText({ path: ['Avatar', 'Season_1', 'Episode_1'] });

		const foundAfter = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'],
		});
		expect(foundAfter.error).toBe(true);

		// Should not delete parent sections
		expect(tree.getMaybeNode({ path: ['Avatar', 'Season_1'] }).error).toBe(
			false
		);
	});

	it('should do nothing when deleting non-existent text (wrong root child)', () => {
		const tree = new CurratedTree(
			JSON.parse(JSON.stringify(avatarNodes)),
			'Library'
		);
		tree.deleteText({ path: ['NotARealThing'] });
		// Should not throw or change tree
		expect(tree.getMaybeNode({ path: ['NotARealThing'] }).error).toBe(true);
		// Existing node still present
		expect(tree.getMaybeNode({ path: ['Intro'] }).error).toBe(false);
	});

	it('should do nothing when deleting non-existent deeply nested text', () => {
		const tree = new CurratedTree(
			JSON.parse(JSON.stringify(avatarNodes)),
			'Library'
		);
		tree.deleteText({ path: ['Avatar', 'Season_2', 'Episode_9'] });
		expect(
			tree.getMaybeNode({ path: ['Avatar', 'Season_2', 'Episode_9'] }).error
		).toBe(true);
		expect(tree.getMaybeNode({ path: ['Avatar', 'Season_2'] }).error).toBe(
			false
		);
	});

	it('should remove empty section nodes up the chain after deleting last child text', () => {
		// We create a tree with a nested structure and just one deep text
		const nodes = [
			{
				type: 'Section',
				name: 'A',
				status: 'NotStarted',
				children: [
					{
						type: 'Section',
						name: 'B',
						status: 'NotStarted',
						children: [
							{
								type: 'Text',
								name: 'C',
								status: 'NotStarted',
								children: [],
							},
						],
					},
				],
			},
		];
		const tree = new CurratedTree(JSON.parse(JSON.stringify(nodes)), 'Library');
		expect(tree.getMaybeNode({ path: ['A', 'B', 'C'] }).error).toBe(false);

		tree.deleteText({ path: ['A', 'B', 'C'] });

		// All chain gone except root ("A" and "B" should be deleted too)
		expect(tree.getMaybeNode({ path: ['A', 'B', 'C'] }).error).toBe(true);
		expect(tree.getMaybeNode({ path: ['A', 'B'] }).error).toBe(true);
		expect(tree.getMaybeNode({ path: ['A'] }).error).toBe(true);
	});
});
