import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import { type TreePath } from '../../../src/managers/currator/currator-types';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('CurratedTree', () => {
	it('should get Intro by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybeNode({ path: ['Intro'] as TreePath });
		expect(node.error).toBe(false);
	});

	it('should get Avatar-Season_1-Episode_1 by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybeNode({
			path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
		});
		expect(node.error).toBe(false);
		if (!node.error) {
			expect(node.data.type).toBe('Text');
		}
	});

	it('should not get Avatar-Season_2-Episode_3 by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybeNode({
			path: ['Avatar', 'Season_2', 'Episode_3'] as TreePath,
		});
		expect(node.error).toBe(true);
	});

	it('should get 000-Intro by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybePage({
			path: ['Intro'] as TreePath,
			index: 0,
		});
		expect(node.error).toBe(false);
	});

	it('should not get 001-Intro by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybePage({
			path: ['Intro'] as TreePath,
			index: 1,
		});
		expect(node.error).toBe(true);
	});

	it('should not get 000-Avatar-Season_1-Episode_1 by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const node = tree.getMaybePage({
			path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
			index: 5,
		});
		expect(node.error).toBe(true);
	});

	it('Should be equal to itself', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const otherTree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		expect(tree.isEqualTo(otherTree)).toBe(true);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts([] as any);
		expect(texts.length).toBeGreaterThan(0);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts(['Avatar'] as any);
		expect(texts.length).toBeGreaterThan(0);
	});

	it('should get texts by path', () => {
		const tree = new CurratedTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts(['Avatar', 'Season_1'] as any);
		expect(texts.length).toBeGreaterThan(0);
	});
});
