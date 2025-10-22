import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import {
	NodeStatus,
	NodeType,
	type SectionNode,
	type TextNode,
} from '../../../src/managers/currator/types';

describe('CurratedTree - Status Computation', () => {
	describe('Status computation on tree creation', () => {
		it('should compute NotStarted status for empty text node', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateTextNode({
				path: ['Section', 'Text'],
			});

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data as TextNode).status).toBe(NodeStatus.NotStarted);
			}
		});

		it('should compute NotStarted status for empty section', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(
					NodeStatus.NotStarted
				);
			}
		});

		it('should compute Done status for text node with all pages Done', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });
			tree.addText({
				path: ['Section', 'Text'],
				pageStatuses: [NodeStatus.Done, NodeStatus.Done],
			});

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data as TextNode).status).toBe(NodeStatus.Done);
			}
		});

		it('should compute InProgress status for text node with mixed page statuses', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });
			tree.addText({
				path: ['Section', 'Text'],
				pageStatuses: [NodeStatus.Done, NodeStatus.NotStarted],
			});

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data as TextNode).status).toBe(NodeStatus.InProgress);
			}
		});

		it('should propagate status to parent section based on children', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.Done],
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(NodeStatus.Done);
			}
		});

		it('should propagate InProgress to parent when children have mixed statuses', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(
					NodeStatus.InProgress
				);
			}
		});

		it('should compute statuses correctly for nested sections', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
				pageStatuses: [NodeStatus.Done],
			});

			const fantasy = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy'],
			});
			const fiction = tree.getMaybeNode({ path: ['Books', 'Fiction'] });
			const books = tree.getMaybeNode({ path: ['Books'] });

			if (!fantasy.error) {
				expect((fantasy.data as SectionNode).status).toBe(NodeStatus.Done);
			}
			if (!fiction.error) {
				expect((fiction.data as SectionNode).status).toBe(NodeStatus.Done);
			}
			if (!books.error) {
				expect((books.data as SectionNode).status).toBe(NodeStatus.Done);
			}
		});
	});

	describe('Status recomputation on adding nodes', () => {
		it('should update section status to InProgress when adding a NotStarted text node', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] });
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
		});

		it('should update grandparent status when adding nested text', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Books', 'Fiction', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			tree.addText({
				path: ['Books', 'NonFiction', 'Text1'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
		});
	});

	describe('Status recomputation on deleting nodes', () => {
		it('should update section status when deleting a text node', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.Done],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			tree.deleteText({ path: ['Section', 'Text1'] });

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			tree.deleteText({ path: ['Section', 'Text2'] });

			// After deleting all texts from a section, the section itself is deleted
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(section.error).toBe(true);
		});

		it('should update parent status up the chain when deleting nodes', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Books', 'Fiction', 'Chapter1'],
				pageStatuses: [NodeStatus.Done],
			});

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			tree.deleteText({ path: ['Books', 'Fiction', 'Chapter1'] });

			// After deleting all texts, all empty parent sections are deleted
			books = tree.getMaybeNode({ path: ['Books'] });
			expect(books.error).toBe(true);
		});

		it('should handle deletion of one child in a multi-child section', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);

			tree.deleteText({ path: ['Section', 'Text1'] });

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.NotStarted
			);
		});
	});

	describe('recomputeStatuses return value', () => {
		it('should return null when no statuses changed', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			// Calling recomputeStatuses when nothing changed should return null
			const result = tree.recomputeStatuses();
			expect(result).toBe(null);
		});

		it('should return the closest to root node that changed', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Books', 'Fiction', 'Chapter1'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			// Manually change a page status to trigger recomputation
			const chapter = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Chapter1'],
			});
			if (!chapter.error) {
				const text = chapter.data as TextNode;
				text.children[0]!.status = NodeStatus.Done;

				const result = tree.recomputeStatuses();

				// The chapter node should be the one that changed (or one of its ancestors)
				expect(result).not.toBe(null);
			}
		});
	});

	describe('Complex scenarios', () => {
		it('should correctly compute status for deeply nested structure', () => {
			const tree = new CurratedTree([], 'Library');

			// Create a complex structure
			tree.addText({
				path: ['Root', 'A', 'A1', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Root', 'A', 'A2', 'Text1'],
				pageStatuses: [NodeStatus.NotStarted],
			});
			tree.addText({
				path: ['Root', 'B', 'B1', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});

			const root = tree.getMaybeNode({ path: ['Root'] });
			const a = tree.getMaybeNode({ path: ['Root', 'A'] });
			const b = tree.getMaybeNode({ path: ['Root', 'B'] });

			if (!root.error) {
				expect((root.data as SectionNode).status).toBe(NodeStatus.InProgress);
			}
			if (!a.error) {
				expect((a.data as SectionNode).status).toBe(NodeStatus.InProgress);
			}
			if (!b.error) {
				expect((b.data as SectionNode).status).toBe(NodeStatus.Done);
			}
		});

		it('should maintain correct statuses after multiple operations', () => {
			const tree = new CurratedTree([], 'Library');

			// Add texts
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.Done],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			// Add another text with NotStarted
			tree.addText({
				path: ['Section', 'Text3'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);

			// Delete one Done text
			tree.deleteText({ path: ['Section', 'Text1'] });

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);

			// Delete remaining Done text
			tree.deleteText({ path: ['Section', 'Text2'] });

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.NotStarted
			);
		});
	});

	describe('changeStatus method', () => {
		it('should change status of a text node', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			const result = tree.changeStatus({
				path: ['Section', 'Text'],
				status: NodeStatus.Done,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(NodeStatus.Done);
			}

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			if (!text.error) {
				expect((text.data as TextNode).status).toBe(NodeStatus.Done);
			}
		});

		it('should return error when node does not exist', () => {
			const tree = new CurratedTree([], 'Library');

			const result = tree.changeStatus({
				path: ['NonExistent', 'Text'],
				status: NodeStatus.Done,
			});

			expect(result.error).toBe(true);
		});

		it('should propagate status change to parent section', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.Done],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			// Change one text to NotStarted
			tree.changeStatus({
				path: ['Section', 'Text1'],
				status: NodeStatus.NotStarted,
			});

			// Section should now be InProgress (mixed statuses)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
		});

		it('should propagate status change up multiple levels', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Books', 'Fiction', 'Chapter1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Books', 'Fiction', 'Chapter2'],
				pageStatuses: [NodeStatus.Done],
			});

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			// Change a deeply nested text
			tree.changeStatus({
				path: ['Books', 'Fiction', 'Chapter1'],
				status: NodeStatus.NotStarted,
			});

			const fiction = tree.getMaybeNode({ path: ['Books', 'Fiction'] });
			books = tree.getMaybeNode({ path: ['Books'] });

			// Fiction should be InProgress (Chapter1 NotStarted, Chapter2 Done)
			expect(!fiction.error && (fiction.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
			// Books should be InProgress too (Fiction is InProgress)
			expect(!books.error && (books.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
		});

		it('should allow changing section status directly', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);

			// Change section status directly (override computed status)
			tree.changeStatus({
				path: ['Section'],
				status: NodeStatus.Done,
			});

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);
		});

		it('should recompute parent status after changing multiple children', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Section', 'Text1'],
				pageStatuses: [NodeStatus.NotStarted],
			});
			tree.addText({
				path: ['Section', 'Text2'],
				pageStatuses: [NodeStatus.NotStarted],
			});

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.NotStarted
			);

			// Change one text to Done
			tree.changeStatus({
				path: ['Section', 'Text1'],
				status: NodeStatus.Done,
			});

			// Section should now be InProgress (mixed)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);

			// Change other text to Done too
			tree.changeStatus({
				path: ['Section', 'Text2'],
				status: NodeStatus.Done,
			});

			// Section should now be Done (all Done)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);
		});

		it('should handle status changes in complex nested structures', () => {
			const tree = new CurratedTree([], 'Library');
			tree.addText({
				path: ['Root', 'A', 'A1', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});
			tree.addText({
				path: ['Root', 'B', 'B1', 'Text1'],
				pageStatuses: [NodeStatus.Done],
			});

			const root = tree.getMaybeNode({ path: ['Root'] });
			expect(!root.error && (root.data as SectionNode).status).toBe(
				NodeStatus.Done
			);

			// Change one nested text
			tree.changeStatus({
				path: ['Root', 'A', 'A1', 'Text1'],
				status: NodeStatus.NotStarted,
			});

			const rootAfter = tree.getMaybeNode({ path: ['Root'] });
			const a = tree.getMaybeNode({ path: ['Root', 'A'] });

			// A should be NotStarted (all its texts are NotStarted)
			expect(!a.error && (a.data as SectionNode).status).toBe(
				NodeStatus.NotStarted
			);
			// Root should be InProgress (A is NotStarted, B is Done)
			expect(!rootAfter.error && (rootAfter.data as SectionNode).status).toBe(
				NodeStatus.InProgress
			);
		});
	});
});
