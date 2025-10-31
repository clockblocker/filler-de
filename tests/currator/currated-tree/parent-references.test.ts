import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import {
	type BookNode,
	type BranchNode,
	NodeType,
	type SectionNode,
	type TreePath,
} from '../../../src/commanders/librarian/types';
import { TextStatus } from '../../../src/types/common-interface/enums';

describe('CurratedTree - Parent References', () => {
	describe('Creating tree with existing nodes', () => {
		it('should set parent to root for direct children of the tree', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Page1': TextStatus.NotStarted },
						path: ['Section1', 'Text1'] as TreePath,
					},
				],
				'Library'
			);

			const section1 = tree.root.children[0];
			expect(section1?.parent).toBe(tree.root);
		});

		it('should set parent references for nested section nodes during tree initialization', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: {},
						path: ['Section1', 'SubSection1', 'Text1'] as TreePath,
					},
				],
				'Library'
			);

			const section1 = tree.root.children[0];
			const subSection1 = (section1 as SectionNode).children[0] as SectionNode;

			expect(section1?.parent).toBe(tree.root);
			expect(subSection1?.parent).toBe(section1 as BranchNode);
		});

		it('should set parent references for text nodes under sections', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: {},
						path: ['Section1', 'Text1'] as TreePath,
					},
				],
				'Library'
			);

			const section1 = tree.root.children[0];
			const text1 = (section1 as SectionNode).children[0];

			expect(section1?.parent).toBe(tree.root);
			expect(text1?.parent).toBe(section1 as BranchNode);
		});

		it('should set parent references for page nodes under text nodes', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Page1': TextStatus.NotStarted, 'Page2': TextStatus.Done },
						path: ['Section1', 'Text1'] as TreePath,
					},
				],
				'Library'
			);

			const section1 = tree.root.children[0];
			const text1 = (section1 as SectionNode).children[0];
			// With multiple pages, it's a BookNode
			if (text1?.type === NodeType.Book) {
				const bookNode = text1;
				const page1 = bookNode.children[0];
				expect(section1?.parent).toBe(tree.root);
				expect(bookNode.parent).toBe(section1 as BranchNode);
				expect(page1?.parent).toBe(bookNode as BranchNode);
			}
		});

		it('should handle deep nesting with correct parent chain', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: {},
						path: ['A', 'B', 'C', 'Text1'] as TreePath,
					},
				],
				'Library'
			);

			const nodeA = tree.root.children[0];
			const nodeB = (nodeA as SectionNode).children[0] as SectionNode;
			const nodeC = (nodeB as SectionNode).children[0] as SectionNode;

			expect(nodeA?.parent).toBe(tree.root);
			expect(nodeB?.parent).toBe(nodeA as BranchNode);
			expect(nodeC?.parent).toBe(nodeB as BranchNode);
		});
	});

	describe('Adding new nodes', () => {
		// Note: getOrCreateSectionNode has been removed - sections are created automatically
		it('should set parent when creating a new section node at root', () => {
			const tree = new LibraryTree([], 'Library');

			// Create a section by creating a text node under it
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['NewSection', 'Temp'],
			});

			const section = tree.getMaybeNode({ path: ['NewSection'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).parent).toBe(tree.root);
			}
		});

		it('should set parent when creating a nested section node', () => {
			const tree = new LibraryTree([], 'Library');

			// Create nested sections by creating text nodes
			tree.getOrCreateTextNode({ pageStatuses: {}, path: ['Parent', 'Temp'] });
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Parent', 'Child', 'Temp'],
			});

			const childSection = tree.getMaybeNode({ path: ['Parent', 'Child'] });
			expect(!childSection.error).toBe(true);
			if (!childSection.error) {
				expect((childSection.data as SectionNode).parent?.name).toBe('Parent');
				expect((childSection.data as SectionNode).parent?.type).toBe(NodeType.Section);
			}
		});

		it('should set parent when creating a text node', () => {
			const tree = new LibraryTree([], 'Library');

			const result = tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Text'],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.parent?.name).toBe('Section');
				expect(result.data.parent?.type).toBe(NodeType.Section);
			}
		});

		it('should set parent for page nodes when using addText', () => {
			const tree = new LibraryTree([], 'Library');

			const result = tree.addText({
				pageStatuses: { 'Page1': TextStatus.NotStarted, 'Page2': TextStatus.Done },
				path: ['Section', 'Text'],
			});

			expect(result.error).toBe(false);
			if (!result.error && result.data.type === NodeType.Book) {
				const bookNode = result.data as BookNode;
				expect(bookNode.children[0]?.parent).toBe(bookNode);
				expect(bookNode.children[1]?.parent).toBe(bookNode);
			}
		});

		it('should maintain parent references when adding to nested structure', () => {
			const tree = new LibraryTree([], 'Library');

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			const chapter1 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});
			const chapter2 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			if (!chapter1.error && !chapter2.error) {
				expect((chapter1.data as BookNode).parent?.name).toBe('Fantasy');
				expect((chapter2.data as BookNode).parent?.name).toBe('Fantasy');
				expect((chapter1.data as BookNode).parent?.type).toBe(NodeType.Section);
				expect((chapter2.data as BookNode).parent?.type).toBe(NodeType.Section);
			}
		});
	});

	describe('Deleting nodes', () => {
		it('should remove text node while maintaining parent structure for siblings', () => {
			const tree = new LibraryTree([], 'Library');

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Chapter1'],
			});
			tree.getOrCreateTextNode({
				pageStatuses: {},
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
				expect((chapter2.data as BookNode).parent?.name).toBe('Section');
			}
		});

		it('should remove empty parent sections and adjust parent references', () => {
			const tree = new LibraryTree([], 'Library');

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['A', 'B', 'C', 'TextNode'],
			});

			tree.deleteText({ path: ['A', 'B', 'C', 'TextNode'] });

			const nodeA = tree.getMaybeNode({ path: ['A'] });
			expect(nodeA.error).toBe(true);
		});

		it('should preserve parent references for nodes in non-empty sections after deletion', () => {
			const tree = new LibraryTree([], 'Library');

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'SubSection1', 'Text1'],
			});
			tree.getOrCreateTextNode({
				pageStatuses: {},
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
				expect((text2.data as BookNode).parent?.name).toBe('SubSection2');
				expect((subSection2.data as SectionNode).parent?.name).toBe('Section');
			}
		});

		it('should maintain correct parent chain after multiple deletions', () => {
			const tree = new LibraryTree([], 'Library');

			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Books', 'Fiction', 'Chapter1'],
			});
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Books', 'Fiction', 'Chapter2'],
			});
			tree.getOrCreateTextNode({
				pageStatuses: {},
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
				expect((chapter2.data as BookNode).parent?.name).toBe('Fiction');
				expect((chapter2.data as BookNode).parent?.parent?.name).toBe('Books');
				expect((chapter2.data as BookNode).parent?.parent?.parent).toBe(tree.root);
			}

			if (!nonfictionChapter.error) {
				expect((nonfictionChapter.data as BookNode).parent?.name).toBe(
					'NonFiction'
				);
				expect((nonfictionChapter.data as BookNode).parent?.parent?.name).toBe(
					'Books'
				);
			}
		});
	});
});
