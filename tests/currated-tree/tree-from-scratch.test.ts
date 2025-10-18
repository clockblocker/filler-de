import { describe, it, expect } from 'bun:test';
import {
	NodeStatus,
	NodeType,
	type TextNode,
	type SectionNode,
} from '../../src/currator/tree-types';
import { CurratedTree } from '../../src/currator/currated-tree';

describe('CurratedTree - Building from scratch', () => {
	describe('getOrCreateSectionNode', () => {
		it('should create a new section at root level', () => {
			const tree = new CurratedTree([], 'Library');
			const result = tree.getOrCreateSectionNode({
				path: ['Books'],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Books');
				expect(result.data.type).toBe(NodeType.Section);
				expect(result.data.status).toBe(NodeStatus.NotStarted);
				expect(result.data.children).toEqual([]);
			}
		});

		it('should create a nested section structure', () => {
			const tree = new CurratedTree([], 'Library');

			// Create first level section
			const booksResult = tree.getOrCreateSectionNode({
				path: ['Books'],
			});
			expect(booksResult.error).toBe(false);

			// Create second level section
			const fantasyResult = tree.getOrCreateSectionNode({
				path: ['Books', 'Fantasy'],
			});
			expect(fantasyResult.error).toBe(false);
			if (!fantasyResult.error) {
				expect(fantasyResult.data.name).toBe('Fantasy');
			}

			// Verify hierarchy
			if (!booksResult.error) {
				expect(booksResult.data.children.length).toBe(1);
				expect(booksResult.data.children[0]?.name).toBe('Fantasy');
			}
		});

		it('should return existing section without creating duplicate', () => {
			const tree = new CurratedTree([], 'Library');

			const first = tree.getOrCreateSectionNode({
				path: ['Books'],
			});

			const second = tree.getOrCreateSectionNode({
				path: ['Books'],
			});

			expect(first.error).toBe(false);
			expect(second.error).toBe(false);
			if (!first.error && !second.error) {
				expect(first.data).toBe(second.data);
			}
		});

		it('should create section with specified status', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateSectionNode({
				path: ['Books'],
				status: NodeStatus.Done,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(NodeStatus.Done);
			}
		});

		it('should fail if path is empty', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateSectionNode({
				path: [] as any,
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toBe('Path is empty');
			}
		});

		it('should fail if parent does not exist', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateSectionNode({
				path: ['NonExistent', 'Child'],
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toContain('not found');
			}
		});

		it('should fail if parent is a text node, not a section', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Chapter1',
						status: NodeStatus.NotStarted,
						type: NodeType.Text,
						children: [],
					} as TextNode,
				],
				'Library'
			);

			const result = tree.getOrCreateSectionNode({
				path: ['Chapter1', 'Section'],
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toBe('Parent is not a section');
			}
		});

		it('should create multiple sections at root level', () => {
			const tree = new CurratedTree([], 'Library');

			const books = tree.getOrCreateSectionNode({ path: ['Books'] });
			const movies = tree.getOrCreateSectionNode({ path: ['Movies'] });
			const music = tree.getOrCreateSectionNode({ path: ['Music'] });

			expect(books.error).toBe(false);
			expect(movies.error).toBe(false);
			expect(music.error).toBe(false);
		});

		it('should create deep nesting through multiple calls', () => {
			const tree = new CurratedTree([], 'Library');

			tree.getOrCreateSectionNode({ path: ['A'] });
			tree.getOrCreateSectionNode({ path: ['A', 'B'] });
			tree.getOrCreateSectionNode({ path: ['A', 'B', 'C'] });
			tree.getOrCreateSectionNode({ path: ['A', 'B', 'C', 'D'] });

			const result = tree.getMaybeNode({ path: ['A', 'B', 'C', 'D'] });
			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('D');
				expect(result.data.type).toBe(NodeType.Section);
			}
		});
	});

	describe('getOrCreateTextNode', () => {
		it('should create a text node under an existing section', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Chapter1');
				expect(result.data.type).toBe(NodeType.Text);
				expect(result.data.status).toBe(NodeStatus.NotStarted);
				expect(result.data.children).toEqual([]);
			}
		});

		it('should create text node with specified status', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
				status: NodeStatus.InProgress,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(NodeStatus.InProgress);
			}
		});

		it('should return existing text node without creating duplicate', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const first = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
			});

			const second = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
			});

			expect(first.error).toBe(false);
			expect(second.error).toBe(false);
			if (!first.error && !second.error) {
				expect(first.data).toBe(second.data);
			}
		});

		it('should create nested sections automatically before creating text node', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateTextNode({
				path: ['Books', 'Fantasy', 'Chapter1'],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Chapter1');
				expect(result.data.type).toBe(NodeType.Text);
			}

			// Verify the sections were created
			const booksNode = tree.getMaybeNode({ path: ['Books'] });
			const fantasyNode = tree.getMaybeNode({
				path: ['Books', 'Fantasy'],
			});

			expect(booksNode.error).toBe(false);
			expect(fantasyNode.error).toBe(false);
		});

		it('should fail if path is empty', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateTextNode({
				path: [] as any,
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toContain('No parent section');
			}
		});

		it('should fail if path has only one element (no parent section)', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getOrCreateTextNode({
				path: ['OnlyName'],
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toContain(
					'No parent section found for TextNode'
				);
			}
		});

		it('should fail if text name is empty after pop', () => {
			const tree = new CurratedTree([], 'Library');

			// After pop, path becomes [] which is invalid
			const result = tree.getOrCreateTextNode({
				path: ['Books'] as any,
			});

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toContain(
					'No parent section found for TextNode'
				);
			}
		});

		it('should create multiple text nodes in same section', () => {
			const tree = new CurratedTree([], 'Library');

			const ch1 = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
			});
			const ch2 = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter2'],
			});
			const ch3 = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter3'],
			});

			expect(ch1.error).toBe(false);
			expect(ch2.error).toBe(false);
			expect(ch3.error).toBe(false);

			if (!ch1.error && !ch2.error && !ch3.error) {
				expect(ch1.data.name).toBe('Chapter1');
				expect(ch2.data.name).toBe('Chapter2');
				expect(ch3.data.name).toBe('Chapter3');
			}
		});

		it('should create complex nested structure with mixed sections and texts', () => {
			const tree = new CurratedTree([], 'Library');

			// Create a structure like: Books/Fiction/Fantasy/Chapter1
			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});

			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'SciFi', 'Chapter1'],
			});

			// Verify the structure
			const booksNode = tree.getMaybeNode({ path: ['Books'] });
			const fictionNode = tree.getMaybeNode({
				path: ['Books', 'Fiction'],
			});
			const fantasyNode = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy'],
			});
			const scifiNode = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'SciFi'],
			});
			const ch1 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			});
			const ch2 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			});

			expect(booksNode.error).toBe(false);
			expect(fictionNode.error).toBe(false);
			expect(fantasyNode.error).toBe(false);
			expect(scifiNode.error).toBe(false);
			expect(ch1.error).toBe(false);
			expect(ch2.error).toBe(false);
		});

		it('should allow reusing existing sections when creating new text nodes', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [
							{
								name: 'Fiction',
								status: NodeStatus.NotStarted,
								type: NodeType.Section,
								children: [],
							} as SectionNode,
						],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getOrCreateTextNode({
				path: ['Books', 'Fiction', 'Chapter1'],
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Chapter1');
			}
		});

		it('should maintain status from first creation when getting existing text node', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const first = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
				status: NodeStatus.Done,
			});

			const second = tree.getOrCreateTextNode({
				path: ['Books', 'Chapter1'],
				status: NodeStatus.InProgress,
			});

			expect(first.error).toBe(false);
			expect(second.error).toBe(false);
			if (!first.error && !second.error) {
				expect(second.data.status).toBe(NodeStatus.Done);
			}
		});
	});

	describe('getParentNode and root handling', () => {
		it('should return tree itself when getting parent of single-element path', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Section1',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getParentNode({ path: ['Section1'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data).toBe(tree);
			}
		});

		it('should return tree itself when getting parent of root-level node', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getParentNode({ path: ['Books'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data).toBe(tree);
			}
		});

		it('should return correct parent for nested path', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [
							{
								name: 'Fiction',
								status: NodeStatus.NotStarted,
								type: NodeType.Section,
								children: [],
							} as SectionNode,
						],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getParentNode({ path: ['Books', 'Fiction'] });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.type).toBe(NodeType.Section);
				expect((result.data as SectionNode).name).toBe('Books');
			}
		});

		it('should return error if node does not exist', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.getParentNode({ path: ['NonExistent'] });

			expect(result.error).toBe(true);
			if (result.error) {
				expect(result.description).toContain('not found');
			}
		});

		it('should return tree itself when getMaybeNode is called with empty path', () => {
			const tree = new CurratedTree(
				[
					{
						name: 'Books',
						status: NodeStatus.NotStarted,
						type: NodeType.Section,
						children: [],
					} as SectionNode,
				],
				'Library'
			);

			const result = tree.getMaybeNode({ path: [] as any });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data).toBe(tree);
			}
		});
	});

	describe('Integration: Combined operations', () => {
		it('should build complex tree from scratch using both create methods', () => {
			const tree = new CurratedTree([], 'Library');

			// Create text node which auto-creates parent sections
			tree.getOrCreateTextNode({
				path: ['Library', 'German', 'Verbs', 'StrongVerbs'],
				status: NodeStatus.Done,
			});

			tree.getOrCreateTextNode({
				path: ['Library', 'German', 'Nouns', 'MasculineNouns'],
				status: NodeStatus.NotStarted,
			});

			// Now use getOrCreateSectionNode for existing section (now supports root)
			const germanSection = tree.getOrCreateSectionNode({
				path: ['Library', 'German'],
				status: NodeStatus.InProgress,
			});

			// Verify entire structure
			const library = tree.getMaybeNode({ path: ['Library'] });
			const german = tree.getMaybeNode({
				path: ['Library', 'German'],
			});
			const verbs = tree.getMaybeNode({
				path: ['Library', 'German', 'Verbs'],
			});
			const strongVerbs = tree.getMaybeNode({
				path: ['Library', 'German', 'Verbs', 'StrongVerbs'],
			});
			const nouns = tree.getMaybeNode({
				path: ['Library', 'German', 'Nouns'],
			});
			const masculineNouns = tree.getMaybeNode({
				path: ['Library', 'German', 'Nouns', 'MasculineNouns'],
			});

			expect(library.error).toBe(false);
			expect(german.error).toBe(false);
			expect(verbs.error).toBe(false);
			expect(strongVerbs.error).toBe(false);
			expect(nouns.error).toBe(false);
			expect(masculineNouns.error).toBe(false);

			// Verify the created nodes
			if (
				!library.error &&
				!german.error &&
				!strongVerbs.error &&
				!masculineNouns.error
			) {
				expect(strongVerbs.data.type).toBe(NodeType.Text);
				expect(strongVerbs.data.status).toBe(NodeStatus.Done);
				expect(masculineNouns.data.type).toBe(NodeType.Text);
			}
		});
	});
});
