import { describe, it, expect } from 'bun:test';
import {
	NodeStatus,
	NodeType,
	type TextNode,
	type TreeNode,
} from '../../src/currator/tree-types';
import { CurratedTree } from '../../src/currator/currated-tree';
import { DEFINED_BRANCHES } from './static/defined-branches';

const avatarNodes = DEFINED_BRANCHES.Avatar.nodes;

describe('CurratedTree', () => {
	it('should get Intro by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybeNode({ path: ['Intro'] });
		expect(node).toEqual({ error: false, data: avatarNodes[1] as TextNode });
	});

	it('should get Avatar-Season_1-Episode_1 by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'],
		});
		expect(node).toEqual({
			error: false,
			data: avatarNodes[0]?.children[0]?.children[0] as TextNode,
		});
	});

	it('should get Avatar-Season_2-Episode_2 by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybeNode({
			path: ['Avatar', 'Season_2', 'Episode_2'],
		});
		expect(node).toEqual({
			error: false,
			data: avatarNodes[0]?.children[1]?.children[1] as TextNode,
		});
	});

	it('should not get Avatar-Season_2-Episode_3 by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybeNode({
			path: ['Avatar', 'Season_2', 'Episode_3'],
		});
		expect(node).toEqual({
			error: true,
			description: 'Node "Episode_3" not found',
		});
	});

	it('should get 000-Intro by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybePage({ path: ['Intro'], index: 0 });
		expect(node).toEqual({
			error: false,
			data: avatarNodes[1]?.children[0],
		});
	});

	it('should not get 001-Intro by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybePage({ path: ['Intro'], index: 1 });
		expect(node).toEqual({
			error: true,
			description: 'Page 1 not found',
		});
	});

	it('should not get 000-Avatar-Season_1-Episode_1 by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const node = tree.getMaybePage({
			path: ['Avatar', 'Season_1', 'Episode_1'],
			index: 1,
		});
		expect(node).toEqual({
			error: true,
			description: 'Page 1 not found',
		});
	});
});
