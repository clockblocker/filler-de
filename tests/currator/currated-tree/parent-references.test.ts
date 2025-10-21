import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import {
	type BranchNode,
	NodeStatus,
	NodeType,
	type SectionNode,
	type TextNode,
	type TreePath,
} from '../../../src/managers/currator/currator-types';

describe('CurratedTree - Parent References', () => {
	describe('Creating tree with existing nodes', () => {
		it('should set parent to null for direct children of the tree', () => {
			const tree = new CurratedTree(
				[
					{
						path: ['Section1', 'Text1'] as TreePath,
						pageStatuses: [NodeStatus.NotStarted],
					},
				],
				'Library'
			);

			const section1 = tree.children[0];
			expect(section1?.parent).toBe(null);
		});

		it('should set parent references for nested section nodes during tree initialization', () => {
			const tree = new CurratedTree(
				[
					{
						path: ['Section1', 'SubSection1'] as TreePath,
						pageStatuses: [],
					},
				],
				'Library'
			);

			const section1 = tree.children[0];
			const subSection1 = (section1 as SectionNode).children[0];

			expect(section1?.parent).toBe(null);
			expect(subSection1?.parent).toBe(section1);
		});

		it('should set parent references for text nodes under sections', () => {
			const tree = new CurratedTree(
				[
					{
						path: ['Section1', 'Text1'] as TreePath,
						pageStatuses: [],
					},
				],
				'Library'
			);

			const section1 = tree.children[0];
			const text1 = (section1 as SectionNode).children[0];

			expect(section1?.parent).toBe(null);
			expect(text1?.parent).toBe(section1);
		});

		it('should set parent references for page nodes under text nodes', () => {
			const tree = new CurratedTree(
				[
					{
						path: ['Section1', 'Text1'] as TreePath,
						pageStatuses: [NodeStatus.NotStarted],
					},
				],
				'Library'
			);

			const section1 = tree.children[0];
			const text1 = (section1 as SectionNode).children[0] as TextNode;
			const page1 = text1.children[0];

			expect(section1?.parent).toBe(null);
			expect(text1?.parent).toBe(section1 as BranchNode);
			expect(page1?.parent).toBe(text1);
		});

		it('should handle deep nesting with correct parent chain', () => {
			const tree = new CurratedTree(
				[
					{
						path: ['A', 'B', 'C'] as TreePath,
						pageStatuses: [],
					},
				],
				'Library'
			);

			const nodeA = tree.children[0];
			const nodeB = (nodeA as SectionNode).children[0];
			const nodeC = (nodeB as SectionNode).children[0] as SectionNode;

			expect(nodeA?.parent).toBe(null);
			expect(nodeB?.parent).toBe(nodeA);
			expect(nodeC?.parent).toBe(nodeB as BranchNode);
		});
	});

	describe('Adding new nodes', () => {
		it('should set parent when creating a new section node at root', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateSectionNode({ path: ['NewSection'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.parent).toBe(null);
			}
		});

		it('should set parent when creating a nested section node', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateSectionNode({ path: ['Parent'] });
			const result = tree.getOrCreateSectionNode({ path: ['Parent', 'Child'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.parent?.name).toBe('Parent');
				expect(result.data.parent?.type).toBe(NodeType.Section);
			}
		});

		it('should set parent when creating a text node', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateSectionNode({ path: ['Section'] });
			const result = tree.getOrCreateTextNode({ path: ['Section', 'Text'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.parent?.name).toBe('Section');
				expect(result.data.parent?.type).toBe(NodeType.Section);
			}
		});

		it('should set parent for page nodes when using addText', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateSectionNode({ path: ['Section'] });
			const result = tree.addText({
				path: ['Section', 'Text'],
				pageStatuses: [NodeStatus.NotStarted, NodeStatus.Done],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.children[0]?.parent).toBe(result.data);
				expect(result.data.children[1]?.parent).toBe(result.data);
			}
		});

		it('should maintain parent references when adding to nested structure', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});

			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			const chapter1 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});
			const chapter2 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			if (!chapter1.error && !chapter2.error) {
				expect((chapter1.data as TextNode).parent?.name).toBe('Fantasy');
				expect((chapter2.data as TextNode).parent?.name).toBe('Fantasy');
				expect((chapter1.data as TextNode).parent?.type).toBe(NodeType.Section);
				expect((chapter2.data as TextNode).parent?.type).toBe(NodeType.Section);
			}
		});
	});

	describe('Deleting nodes', () => {
		it('should remove text node while maintaining parent structure for siblings', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateTextNode({
				path: ['Section', 'Chapter1'],
			});
			tree.getOrCreateTextNode({
				path: ['Section', 'Chapter2'],
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(
				!section.error && (section.data as SectionNode).children.length
			).toBe(2);

			tree.deleteText({ path: ['Section', 'Chapter1'] });

			const chapter2 = tree.getMaybeNode({ path: ['Section', 'Chapter2'] });
			expect(!chapter2.error).toBe(true);
			if (!chapter2.error) {
				expect((chapter2.data as TextNode).parent?.name).toBe('Section');
			}
		});

		it('should remove empty parent sections and adjust parent references', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateTextNode({
				path: ['A', 'B', 'C', 'TextNode'],
			});

			tree.deleteText({ path: ['A', 'B', 'C', 'TextNode'] });

			const nodeA = tree.getMaybeNode({ path: ['A'] });
			expect(nodeA.error).toBe(true);
		});

		it('should preserve parent references for nodes in non-empty sections after deletion', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateTextNode({
				path: ['Section', 'SubSection1', 'Text1'],
			});
			tree.getOrCreateTextNode({
				path: ['Section', 'SubSection2', 'Text2'],
			});

			tree.deleteText({ path: ['Section', 'SubSection1', 'Text1'] });

			const text2 = tree.getMaybeNode({
				path: ['Section', 'SubSection2', 'Text2'],
			});
			const subSection2 = tree.getMaybeNode({
				path: ['Section', 'SubSection2'],
			});

			expect(!text2.error).toBe(true);
			expect(!subSection2.error).toBe(true);

			if (!text2.error && !subSection2.error) {
				expect((text2.data as TextNode).parent?.name).toBe('SubSection2');
				expect((subSection2.data as SectionNode).parent?.name).toBe('Section');
			}
		});

		it('should maintain correct parent chain after multiple deletions', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Chapter1'],
			});
			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Chapter2'],
			});
			tree.getOrCreateTextNode({
				path: ['Books', 'NonFiction', 'Chapter1'],
			});

			tree.deleteText({ path: ['Books', 'Fiction', 'Chapter1'] });

			const chapter2 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Chapter2'],
			});
			const nonfictionChapter = tree.getMaybeNode({
				path: ['Books', 'NonFiction', 'Chapter1'],
			});

			if (!chapter2.error) {
				expect((chapter2.data as TextNode).parent?.name).toBe('Fiction');
				expect((chapter2.data as TextNode).parent?.parent?.name).toBe('Books');
				expect((chapter2.data as TextNode).parent?.parent?.parent).toBe(null);
			}

			if (!nonfictionChapter.error) {
				expect((nonfictionChapter.data as TextNode).parent?.name).toBe(
					'NonFiction'
				);
				expect((nonfictionChapter.data as TextNode).parent?.parent?.name).toBe(
					'Books'
				);
			}
		});
	});
});
