import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import {
	NodeType,
	type TreePath,
} from '../../../src/commanders/librarian/types';
import { VALID_BRANCHES } from '../static/defined-branches';

describe('CurratedTree - Read-only methods', () => {
	describe('getMaybeNode', () => {
		it('should get Intro by path', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const node = tree.getMaybeNode({ path: ['Intro'] as TreePath });
			expect(node.error).toBe(false);
		});

		it('should get Avatar-Season_1-Episode_1 by path', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const node = tree.getMaybeNode({
				path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
			});
			expect(node.error).toBe(false);
		});

		it('should not get Avatar-Season_2-Episode_3 by path', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const node = tree.getMaybeNode({
				path: ['Avatar', 'Season_2', 'Episode_3'] as TreePath,
			});
			expect(node.error).toBe(true);
		});
	});

	describe('getMaybeText', () => {
		it('should get Intro text node', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const text = tree.getMaybeText({ path: ['Intro'] as TreePath });
			expect(text.error).toBe(false);
			if (!text.error) {
				expect(text.data.type).toBe(NodeType.Scroll);
			}
		});

		it('should get Avatar-Season_1-Episode_1 text node', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const text = tree.getMaybeText({
				path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
			});
			expect(text.error).toBe(false);
			if (!text.error) {
				expect(
					text.data.type === NodeType.Book ||
						text.data.type === NodeType.Scroll
				).toBe(true);
			}
		});

		it('should get Avatar-Season_1-Episode_2 book node', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const text = tree.getMaybeText({
				path: ['Avatar', 'Season_1', 'Episode_2'] as TreePath,
			});
			expect(text.error).toBe(false);
			if (!text.error) {
				expect(text.data.type).toBe(NodeType.Book);
			}
		});

		it('should not get section node as text', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const text = tree.getMaybeText({
				path: ['Avatar'] as TreePath,
			});
			expect(text.error).toBe(true);
		});

		it('should not get non-existent text', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const text = tree.getMaybeText({
				path: ['Avatar', 'Season_2', 'Episode_3'] as TreePath,
			});
			expect(text.error).toBe(true);
		});
	});

	describe('getMaybePage', () => {
		it('should get Page1 from Episode_2 book', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page1',
				textPath: ['Avatar', 'Season_1', 'Episode_2'] as TreePath,
			});
			expect(page.error).toBe(false);
			if (!page.error) {
				expect(page.data.type).toBe(NodeType.Page);
				expect(page.data.name).toBe('Page1');
			}
		});

		it('should get Page2 from Episode_2 book', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page2',
				textPath: ['Avatar', 'Season_1', 'Episode_2'] as TreePath,
			});
			expect(page.error).toBe(false);
			if (!page.error) {
				expect(page.data.type).toBe(NodeType.Page);
				expect(page.data.name).toBe('Page2');
			}
		});

		it('should not get page from ScrollNode (Intro)', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page1',
				textPath: ['Intro'] as TreePath,
			});
			expect(page.error).toBe(true);
		});

		it('should not get page from ScrollNode (Episode_1)', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page1',
				textPath: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
			});
			expect(page.error).toBe(true);
		});

		it('should not get non-existent page from book', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page3',
				textPath: ['Avatar', 'Season_1', 'Episode_2'] as TreePath,
			});
			expect(page.error).toBe(true);
		});

		it('should not get page from non-existent text', () => {
			const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
			const page = tree.getMaybePage({
				pageName: 'Page1',
				textPath: ['Avatar', 'Season_2', 'Episode_3'] as TreePath,
			});
			expect(page.error).toBe(true);
		});
	});

	it('Should be equal to itself', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const otherTree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		expect(tree.isEqualTo(otherTree)).toBe(true);
	});

	it('should get texts by path', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts([] as any);
		expect(texts.length).toBeGreaterThan(0);
	});

	it('should get texts by path', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts(['Avatar'] as any);
		expect(texts.length).toBeGreaterThan(0);
	});

	it('should get texts by path', () => {
		const tree = new LibraryTree(VALID_BRANCHES.Avatar.texts, 'Library');
		const texts = tree.getTexts(['Avatar', 'Season_1'] as any);
		expect(texts.length).toBeGreaterThan(0);
	});
});
