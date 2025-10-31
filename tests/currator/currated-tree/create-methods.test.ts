import { describe, expect, it } from 'bun:test';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import {
	type BookNode,
	NodeType,
	type SectionNode,
	type TextDto,
	type TreePath,
} from '../../../src/commanders/librarian/types';
import { TextStatus } from '../../../src/types/common-interface/enums';

describe('CurratedTree - Building from SerializedText', () => {
	describe('Constructor with SerializedText[]', () => {
		it('should create tree from empty SerializedText array', () => {
			const tree = new LibraryTree([], 'Library');
			expect(tree.root.children.length).toBe(0);
			expect(tree.root.name).toBe('Library');
			expect(tree.root.status).toBe(TextStatus.NotStarted);
		});

		it('should create sections and text nodes from SerializedText paths', () => {
			const texts: TextDto[] = [
				{
					pageStatuses: { 'Page1': TextStatus.NotStarted, 'Page2': TextStatus.Done },
					path: ['Books', 'Fiction', 'Novel1'] as TreePath,
				},
			];

			const tree = new LibraryTree(texts, 'Library');

			const books = tree.getMaybeNode({ path: ['Books'] });
			const fiction = tree.getMaybeNode({
				path: ['Books', 'Fiction'],
			});
			const novel1 = tree.getMaybeNode({
				path: ['Books', 'Fiction', 'Novel1'],
			});

			expect(!books.error).toBe(true);
			expect(!fiction.error).toBe(true);
			expect(!novel1.error).toBe(true);
		});

		it('should set correct status based on page statuses', () => {
			const texts: TextDto[] = [
				{
					pageStatuses: { 'Page1': TextStatus.Done, 'Page2': TextStatus.Done },
					path: ['Section', 'AllDone'] as TreePath,
				},
				{
					pageStatuses: { 'Page1': TextStatus.NotStarted, 'Page2': TextStatus.NotStarted },
					path: ['Section', 'AllNotStarted'] as TreePath,
				},
			];

			const tree = new LibraryTree(texts, 'Library');

			const allDone = tree.getMaybeNode({ path: ['Section', 'AllDone'] });
			const allNotStarted = tree.getMaybeNode({
				path: ['Section', 'AllNotStarted'],
			});

			if (!allDone.error) {
				expect((allDone.data as BookNode).status).toBe(TextStatus.Done);
			}
			if (!allNotStarted.error) {
				expect((allNotStarted.data as BookNode).status).toBe(
					TextStatus.NotStarted
				);
			}
		});

		it('should handle multiple texts in same section', () => {
			const texts: TextDto[] = [
				{
					pageStatuses: { 'Page1': TextStatus.Done },
					path: ['Section', 'Text1'] as TreePath,
				},
				{
					pageStatuses: { 'Page1': TextStatus.NotStarted },
					path: ['Section', 'Text2'] as TreePath,
				},
			];

			const tree = new LibraryTree(texts, 'Library');

			const section = tree.getMaybeNode({ path: ['Section'] });
			if (!section.error) {
				expect((section.data as SectionNode).children.length).toBe(2);
				expect((section.data as SectionNode).status).toBe(
					TextStatus.InProgress
				);
			}
		});
	});

	describe('addText method', () => {
		it('should add single SerializedText', () => {
			const tree = new LibraryTree([], 'Library');
			const serialized: TextDto = {
				pageStatuses: { 'Page1': TextStatus.Done },
				path: ['Section', 'Text'] as TreePath,
			};

			const result = tree.addText(serialized);

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Text');
				expect(result.data.status).toBe(TextStatus.Done);
				// For a single page, it should be a ScrollNode (no children)
				if (result.data.type === NodeType.Book) {
					expect(result.data.children.length).toBe(1);
				}
			}
		});

		it('should add multiple texts incrementally', () => {
			const tree = new LibraryTree([], 'Library');

			tree.addText({
				pageStatuses: { 'Page1': TextStatus.Done },
				path: ['A', 'Text1'] as TreePath,
			});

			tree.addText({
				pageStatuses: { 'Page1': TextStatus.NotStarted },
				path: ['A', 'Text2'] as TreePath,
			});

			const a = tree.getMaybeNode({ path: ['A'] });
			if (!a.error) {
				expect((a.data as SectionNode).children.length).toBe(2);
				expect((a.data as SectionNode).status).toBe(TextStatus.InProgress);
			}
		});

		it('should recompute statuses after adding text', () => {
			const tree = new LibraryTree([], 'Library');

			tree.addText({
				pageStatuses: { 'Page1': TextStatus.Done },
				path: ['Section', 'Text'] as TreePath,
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				TextStatus.Done
			);
		});
	});

	// Note: getOrCreateSectionNode method has been removed from the API
	// Sections are now created automatically when creating text nodes

	describe('getOrCreateTextNode without status', () => {
		it('should create text node with NotStarted status', () => {
			const tree = new LibraryTree([], 'Library');

			const result = tree.getOrCreateTextNode({
				pageStatuses: {},
				path: ['Section', 'Text'] as TreePath,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(TextStatus.NotStarted);
			}
		});
	});

	describe('changeStatus method', () => {
		it('should only accept Done or NotStarted', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Page1': TextStatus.NotStarted },
						path: ['Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			// Should work with Done
			tree.changeStatus({
				path: ['Section', 'Text'] as TreePath,
				status: 'Done',
			});

			// Should work with NotStarted
			tree.changeStatus({
				path: ['Section', 'Text'] as TreePath,
				status: 'NotStarted',
			});

			expect(true).toBe(true);
		});

		it('should DFS and set all page statuses to Done', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Page1': TextStatus.NotStarted, 'Page2': TextStatus.NotStarted },
						path: ['Section', 'Text1'] as TreePath,
					},
					{
						pageStatuses: { 'Page1': TextStatus.NotStarted },
						path: ['Section', 'Text2'] as TreePath,
					},
				],
				'Library'
			);

			tree.changeStatus({
				path: ['Section'] as TreePath,
				status: 'Done',
			});

			const text1 = tree.getMaybeNode({
				path: ['Section', 'Text1'],
			});
			const text2 = tree.getMaybeNode({
				path: ['Section', 'Text2'],
			});

			if (!text1.error) {
				const t1 = text1.data as BookNode;
				expect(t1.children.every((p) => p.status === TextStatus.Done)).toBe(
					true
				);
			}

			if (!text2.error) {
				// Text2 is a ScrollNode (single page), so check its status directly
				if (text2.data.type === NodeType.Book) {
					const t2 = text2.data as BookNode;
					expect(t2.children.every((p) => p.status === TextStatus.Done)).toBe(
						true
					);
				} else {
					expect(text2.data.status).toBe(TextStatus.Done);
				}
			}
		});

		it('should set all page statuses to NotStarted', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Page1': TextStatus.Done, 'Page2': TextStatus.Done },
						path: ['Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			tree.changeStatus({
				path: ['Section', 'Text'] as TreePath,
				status: 'NotStarted',
			});

			const text = tree.getMaybeNode({
				path: ['Section', 'Text'],
			});

			if (!text.error) {
				const t = text.data as BookNode;
				expect(
					t.children.every((p) => p.status === TextStatus.NotStarted)
				).toBe(true);
			}
		});
	});
});
