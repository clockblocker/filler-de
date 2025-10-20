import { describe, it, expect } from 'bun:test';
import {
	NodeStatus,
	type PageNode,
	type TextNode,
} from '../../src/currator/tree-types';
import { CurratedTree } from '../../src/currator/currated-tree/currated-tree';
import { VALID_BRANCHES } from './static/defined-branches';

const avatarNodes = VALID_BRANCHES.Avatar.nodes;

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
			data: (avatarNodes[0]?.children[0] as any)?.children[0] as TextNode,
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
			data: avatarNodes[1]?.children[0] as PageNode,
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

	it('Should be equal to itself', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const diff = tree.getDiff(tree);
		expect(diff).toEqual([]);
		expect(tree.isEqualTo(tree)).toBe(true);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const texts = tree.getTexts(['Intro']);
		expect(texts).toEqual([
			{ path: ['Intro'], pageStatuses: [NodeStatus.NotStarted] },
		]);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const texts = tree.getTexts(['Avatar', 'Season_1', 'Episode_1']);
		expect(texts).toEqual([
			{
				path: ['Avatar', 'Season_1', 'Episode_1'],
				pageStatuses: [NodeStatus.NotStarted],
			},
		]);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(avatarNodes, 'Library');
		const texts = tree.getTexts(['Avatar', 'Season_2', 'Episode_1']);
		expect(texts).toEqual([
			{
				path: ['Avatar', 'Season_2', 'Episode_1'],
				pageStatuses: [NodeStatus.NotStarted],
			},
		]);
	});
});
