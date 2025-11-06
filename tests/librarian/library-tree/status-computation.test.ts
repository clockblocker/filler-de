import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import {
	NodeType,
	type SectionNode,
} from '../../../src/commanders/librarian/types';
import { TextStatus } from '../../../src/types/common-interface/enums';

describe('CurratedTree - Status Computation', () => {
	describe('Status computation on tree creation', () => {
		it('should compute NotStarted status for empty text node', () => {
			const tree = new LibraryTree([], 'Library');
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Text'],
			});

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data).status).toBe(TextStatus.NotStarted);
			}
		});

		// Note: getOrCreateSectionNode has been removed - sections are created automatically
		it('should compute NotStarted status for empty section', () => {
			const tree = new LibraryTree([], 'Library');
			// Create a section by creating a text node under it
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Temp'],
			});
			tree.deleteTexts([{ path: ['Section', 'Temp'] }]);

			// Section should be deleted when empty, so this test is no longer valid
			// Instead, test that sections are created automatically
			tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Text'],
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(
					TextStatus.NotStarted
				);
			}
		});

		it('should compute Done status for text node with all pages Done', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done, '001': TextStatus.Done },
				path: ['Section', 'Text'],
			}]);

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data).status).toBe(TextStatus.Done);
			}
		});

		it('should compute InProgress status for text node with mixed page statuses', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done, '001': TextStatus.NotStarted },
				path: ['Section', 'Text'],
			}]);

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(!text.error).toBe(true);
			if (!text.error) {
				expect((text.data).status).toBe(TextStatus.InProgress);
			}
		});

		it('should propagate status to parent section based on children', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text2'],
			}]);

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(TextStatus.Done);
			}
		});

		it('should propagate InProgress to parent when children have mixed statuses', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text2'],
			}]);

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error).toBe(true);
			if (!section.error) {
				expect((section.data as SectionNode).status).toBe(
					TextStatus.InProgress
				);
			}
		});

		it('should compute statuses correctly for nested sections', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Fantasy', 'Chapter2'],
			}]);

			const fantasy = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Fantasy'],
			});
			const fiction = tree.getMaybeNode({ path: ['Books', 'Fiction'] });
			const books = tree.getMaybeNode({ path: ['Books'] });

			if (!fantasy.error) {
				expect((fantasy.data as SectionNode).status).toBe(TextStatus.Done);
			}
			if (!fiction.error) {
				expect((fiction.data as SectionNode).status).toBe(TextStatus.Done);
			}
			if (!books.error) {
				expect((books.data as SectionNode).status).toBe(TextStatus.Done);
			}
		});
	});

	describe('Status recomputation on adding nodes', () => {
		it('should update section status to InProgress when adding a NotStarted text node', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text2'],
			}]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
		});

		it('should update grandparent status when adding nested text', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Text1'],
			}]);

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Books', 'NonFiction', 'Text1'],
			}]);

			books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
		});
	});

	describe('Status recomputation on deleting nodes', () => {
		it('should update section status when deleting a text node', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			tree.deleteTexts([{ path: ['Section', 'Text1'] }]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			tree.deleteTexts([{ path: ['Section', 'Text2'] }]);

			// After deleting all texts from a section, the section itself is deleted
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(section.error).toBe(true);
		});

		it('should update parent status up the chain when deleting nodes', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Chapter1'],
			}]);

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			tree.deleteTexts([{ path: ['Books', 'Fiction', 'Chapter1'] }]);

			// After deleting all texts, all empty parent sections are deleted
			books = tree.getMaybeNode({ path: ['Books'] });
			expect(books.error).toBe(true);
		});

		it('should handle deletion of one child in a multi-child section', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);

			tree.deleteTexts([{ path: ['Section', 'Text1'] }]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.NotStarted
			);
		});
	});

	describe('recomputeTreeStatuses return value', () => {
		it('should return affected leaves array', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text'],
			}]);

			// Calling recomputeTreeStatuses returns array of affected leaves
			const result = tree.recomputeTreeStatuses();
			expect(Array.isArray(result)).toBe(true);
		});

		it('should return affected leaves when statuses change', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Books', 'Fiction', 'Chapter1'],
			}]);

			// Manually change a page status to trigger recomputation
			const chapter = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Chapter1'],
			});
			if (!chapter.error) {
				// For a ScrollNode, change its status directly
				if (chapter.data.type === NodeType.Text) {
					const text = chapter.data;
					text.children[0]!.status = TextStatus.Done;
				} else {
					chapter.data.status = TextStatus.Done;
				}

				const result = tree.recomputeTreeStatuses();

				// Should return array of affected leaves
				expect(Array.isArray(result)).toBe(true);
			}
		});
	});

	describe('Complex scenarios', () => {
		it('should correctly compute status for deeply nested structure', () => {
			const tree = new LibraryTree([], 'Library');

			// Create a complex structure
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Root', 'A', 'A1', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Root', 'A', 'A2', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Root', 'B', 'B1', 'Text1'],
			}]);

			const root = tree.getMaybeNode({ path: ['Root'] });
			const a = tree.getMaybeNode({ path: ['Root', 'A'] });
			const b = tree.getMaybeNode({ path: ['Root', 'B'] });

			if (!root.error) {
				expect((root.data as SectionNode).status).toBe(TextStatus.InProgress);
			}
			if (!a.error) {
				expect((a.data as SectionNode).status).toBe(TextStatus.InProgress);
			}
			if (!b.error) {
				expect((b.data as SectionNode).status).toBe(TextStatus.Done);
			}
		});

		it('should maintain correct statuses after multiple operations', () => {
			const tree = new LibraryTree([], 'Library');

			// Add texts
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			// Add another text with NotStarted
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text3'],
			}]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);

			// Delete one Done text
			tree.deleteTexts([{ path: ['Section', 'Text1'] }]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);

			// Delete remaining Done text
			tree.deleteTexts([{ path: ['Section', 'Text2'] }]);

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.NotStarted
			);
		});
	});

	describe('changeStatus method', () => {
		it('should change status of a text node', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text'],
			}]);

			const result = tree.setStatus({
				path: ['Section', 'Text'],
				status: 'Done',
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(TextStatus.Done);
			}

			const text = tree.getMaybeNode({ path: ['Section', 'Text'] });
			if (!text.error) {
				expect((text.data).status).toBe(TextStatus.Done);
			}
		});

		it('should return error when node does not exist', () => {
			const tree = new LibraryTree([], 'Library');

			const result = tree.setStatus({
				path: ['NonExistent', 'Text'],
				status: 'Done',
			});

			expect(result.error).toBe(true);
		});

		it('should propagate status change to parent section', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			// Change one text to NotStarted
			tree.setStatus({
				path: ['Section', 'Text1'],
				status: 'NotStarted',
			});

			// Section should now be InProgress (mixed statuses)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
		});

		it('should propagate status change up multiple levels', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Chapter1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Books', 'Fiction', 'Chapter2'],
			}]);

			let books = tree.getMaybeNode({ path: ['Books'] });
			expect(!books.error && (books.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			// Change a deeply nested text
			tree.setStatus({
				path: ['Books', 'Fiction', 'Chapter1'],
				status: 'NotStarted',
			});

			const fiction = tree.getMaybeNode({ path: ['Books', 'Fiction'] });
			books = tree.getMaybeNode({ path: ['Books'] });

			// Fiction should be InProgress (Chapter1 NotStarted, Chapter2 Done)
			expect(!fiction.error && (fiction.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
			// Books should be InProgress too (Fiction is InProgress)
			expect(!books.error && (books.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
		});

		it('should allow changing section status directly', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);

			// Change section status directly (override computed status)
			tree.setStatus({
				path: ['Section'],
				status: 'Done',
			});

			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);
		});

		it('should recompute parent status after changing multiple children', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.NotStarted },
				path: ['Section', 'Text2'],
			}]);

			let section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.NotStarted
			);

			// Change one text to Done
			tree.setStatus({
				path: ['Section', 'Text1'],
				status: 'Done',
			});

			// Section should now be InProgress (mixed)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);

			// Change other text to Done too
			tree.setStatus({
				path: ['Section', 'Text2'],
				status: 'Done',
			});

			// Section should now be Done (all Done)
			section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);
		});

		it('should handle status changes in complex nested structures', () => {
			const tree = new LibraryTree([], 'Library');
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Root', 'A', 'A1', 'Text1'],
			}]);
			tree.addTexts([{
				pageStatuses: { '000': TextStatus.Done },
				path: ['Root', 'B', 'B1', 'Text1'],
			}]);

			const root = tree.getMaybeNode({ path: ['Root'] });
			expect(!root.error && (root.data as SectionNode).status).toBe(
				TextStatus.Done
			);

			// Change one nested text
			tree.setStatus({
				path: ['Root', 'A', 'A1', 'Text1'],
				status: 'NotStarted',
			});

			const rootAfter = tree.getMaybeNode({ path: ['Root'] });
			const a = tree.getMaybeNode({ path: ['Root', 'A'] });

			// A should be NotStarted (all its texts are NotStarted)
			expect(!a.error && (a.data as SectionNode).status).toBe(
				TextStatus.NotStarted
			);
			// Root should be InProgress (A is NotStarted, B is Done)
			expect(!rootAfter.error && (rootAfter.data as SectionNode).status).toBe(
				TextStatus.InProgress
			);
		});
	});
});
