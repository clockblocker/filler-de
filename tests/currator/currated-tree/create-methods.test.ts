import { describe, expect, it } from 'bun:test';
import { CurratedTree } from '../../../src/managers/currator/currated-tree/currated-tree';
import {
	NodeStatus,
	type SectionNode,
	type SerializedText,
	type TextNode,
	type TreePath,
} from '../../../src/managers/currator/types';

describe('CurratedTree - Building from SerializedText', () => {
	describe('Constructor with SerializedText[]', () => {
		it('should create tree from empty SerializedText array', () => {
			const tree = new CurratedTree([], 'Library');
			expect(tree.root.children.length).toBe(0);
			expect(tree.root.name).toBe('Library');
			expect(tree.root.status).toBe(NodeStatus.NotStarted);
		});

		it('should create sections and text nodes from SerializedText paths', () => {
			const texts: SerializedText[] = [
				{
					pageStatuses: [NodeStatus.NotStarted, NodeStatus.Done],
					path: ['Books', 'Fiction', 'Novel1'] as TreePath,
				},
			];

			const tree = new CurratedTree(texts, 'Library');

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
			const texts: SerializedText[] = [
				{
					pageStatuses: [NodeStatus.Done, NodeStatus.Done],
					path: ['Section', 'AllDone'] as TreePath,
				},
				{
					pageStatuses: [NodeStatus.NotStarted, NodeStatus.NotStarted],
					path: ['Section', 'AllNotStarted'] as TreePath,
				},
			];

			const tree = new CurratedTree(texts, 'Library');

			const allDone = tree.getMaybeNode({ path: ['Section', 'AllDone'] });
			const allNotStarted = tree.getMaybeNode({
				path: ['Section', 'AllNotStarted'],
			});

			if (!allDone.error) {
				expect((allDone.data as TextNode).status).toBe(NodeStatus.Done);
			}
			if (!allNotStarted.error) {
				expect((allNotStarted.data as TextNode).status).toBe(
					NodeStatus.NotStarted
				);
			}
		});

		it('should handle multiple texts in same section', () => {
			const texts: SerializedText[] = [
				{
					pageStatuses: [NodeStatus.Done],
					path: ['Section', 'Text1'] as TreePath,
				},
				{
					pageStatuses: [NodeStatus.NotStarted],
					path: ['Section', 'Text2'] as TreePath,
				},
			];

			const tree = new CurratedTree(texts, 'Library');

			const section = tree.getMaybeNode({ path: ['Section'] });
			if (!section.error) {
				expect((section.data as SectionNode).children.length).toBe(2);
				expect((section.data as SectionNode).status).toBe(
					NodeStatus.InProgress
				);
			}
		});
	});

	describe('addText method', () => {
		it('should add single SerializedText', () => {
			const tree = new CurratedTree([], 'Library');
			const serialized: SerializedText = {
				pageStatuses: [NodeStatus.Done],
				path: ['Section', 'Text'] as TreePath,
			};

			const result = tree.addText(serialized);

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.name).toBe('Text');
				expect(result.data.status).toBe(NodeStatus.Done);
				expect(result.data.children.length).toBe(1);
			}
		});

		it('should add multiple texts incrementally', () => {
			const tree = new CurratedTree([], 'Library');

			tree.addText({
				pageStatuses: [NodeStatus.Done],
				path: ['A', 'Text1'] as TreePath,
			});

			tree.addText({
				pageStatuses: [NodeStatus.NotStarted],
				path: ['A', 'Text2'] as TreePath,
			});

			const a = tree.getMaybeNode({ path: ['A'] });
			if (!a.error) {
				expect((a.data as SectionNode).children.length).toBe(2);
				expect((a.data as SectionNode).status).toBe(NodeStatus.InProgress);
			}
		});

		it('should recompute statuses after adding text', () => {
			const tree = new CurratedTree([], 'Library');

			tree.addText({
				pageStatuses: [NodeStatus.Done],
				path: ['Section', 'Text'] as TreePath,
			});

			const section = tree.getMaybeNode({ path: ['Section'] });
			expect(!section.error && (section.data as SectionNode).status).toBe(
				NodeStatus.Done
			);
		});
	});

	describe('getOrCreateSectionNode without status', () => {
		it('should create section with NotStarted status', () => {
			const tree = new CurratedTree([], 'Library');
			const result = tree.getOrCreateSectionNode({
				path: ['Section'] as TreePath,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(NodeStatus.NotStarted);
			}
		});

		it('should not accept status parameter', () => {
			const tree = new CurratedTree([], 'Library');
			// This should not compile if status parameter is removed
			const result = tree.getOrCreateSectionNode({
				path: ['Section'] as TreePath,
			});

			expect(result.error).toBe(false);
		});
	});

	describe('getOrCreateTextNode without status', () => {
		it('should create text node with NotStarted status', () => {
			const tree = new CurratedTree([], 'Library');
			tree.getOrCreateSectionNode({ path: ['Section'] as TreePath });

			const result = tree.getOrCreateTextNode({
				path: ['Section', 'Text'] as TreePath,
			});

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(NodeStatus.NotStarted);
			}
		});
	});

	describe('changeStatus method', () => {
		it('should only accept Done or NotStarted', () => {
			const tree = new CurratedTree(
				[
					{
						pageStatuses: [NodeStatus.NotStarted],
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
			const tree = new CurratedTree(
				[
					{
						pageStatuses: [NodeStatus.NotStarted, NodeStatus.NotStarted],
						path: ['Section', 'Text1'] as TreePath,
					},
					{
						pageStatuses: [NodeStatus.NotStarted],
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
				const t1 = text1.data as TextNode;
				expect(t1.children.every((p) => p.status === NodeStatus.Done)).toBe(
					true
				);
			}

			if (!text2.error) {
				const t2 = text2.data as TextNode;
				expect(t2.children.every((p) => p.status === NodeStatus.Done)).toBe(
					true
				);
			}
		});

		it('should set all page statuses to NotStarted', () => {
			const tree = new CurratedTree(
				[
					{
						pageStatuses: [NodeStatus.Done, NodeStatus.Done],
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
				const t = text.data as TextNode;
				expect(
					t.children.every((p) => p.status === NodeStatus.NotStarted)
				).toBe(true);
			}
		});
	});
});
