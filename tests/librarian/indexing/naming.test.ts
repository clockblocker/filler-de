import { describe, expect, it } from 'bun:test';
import {
	getLibraryFileToFileFromNode,
	getTreePathFromLibraryFile,
} from '../../../src/commanders/librarian/indexing/libraryFileAdapters';
import { LibraryTree } from '../../../src/commanders/librarian/library-tree/library-tree';
import { getTreePathFromNode } from '../../../src/commanders/librarian/pure-functions/node';
import type { TreeNode, TreePath } from '../../../src/commanders/librarian/types';
import { TextStatus } from '../../../src/types/common-interface/enums';

describe('naming functions', () => {
	describe('getLibraryFileToFileFromNode and getTreePathFromLibraryFile round-trip', () => {
		it('should round-trip Page node correctly', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { '000': TextStatus.NotStarted, '001': TextStatus.Done },
						path: ['Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			const textNode = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(textNode.error).toBe(false);
			if (textNode.error) return;

			const pageNode = (textNode.data).type === 'Text'
				? (textNode.data).children[0]
				: null;

			expect(pageNode).not.toBeNull();
			if (!pageNode) return;

			const expectedPath = getTreePathFromNode(pageNode);
			const libraryFile = getLibraryFileToFileFromNode(pageNode);
			const actualPath = getTreePathFromLibraryFile(libraryFile);

			expect(actualPath).toEqual(expectedPath);
		});

		it('should round-trip Scroll node (single page) correctly', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { 'Scroll': TextStatus.NotStarted },
						path: ['Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			const textNode = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(textNode.error).toBe(false);
			if (textNode.error) return;

			const expectedPath = getTreePathFromNode(textNode.data as TreeNode);
			const libraryFile = getLibraryFileToFileFromNode(textNode.data as TreeNode);
			const actualPath = getTreePathFromLibraryFile(libraryFile);

			expect(actualPath).toEqual(expectedPath);
		});

		it('should round-trip Codex node (Text with multiple pages) correctly', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: {
							'000': TextStatus.NotStarted,
							'001': TextStatus.Done,
							'002': TextStatus.InProgress,
						},
						path: ['Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			const textNode = tree.getMaybeNode({ path: ['Section', 'Text'] });
			expect(textNode.error).toBe(false);
			if (textNode.error) return;

			const expectedPath = getTreePathFromNode(textNode.data as TreeNode);
			const libraryFile = getLibraryFileToFileFromNode(textNode.data as TreeNode);
			const actualPath = getTreePathFromLibraryFile(libraryFile);

			expect(actualPath).toEqual(expectedPath);
		});

		it('should round-trip Section node correctly', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: { '000': TextStatus.NotStarted },
						path: ['Section1', 'SubSection', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			const sectionNode = tree.getMaybeNode({ path: ['Section1'] });
			expect(sectionNode.error).toBe(false);
			if (sectionNode.error) return;

			const expectedPath = getTreePathFromNode(sectionNode.data as TreeNode);
			const libraryFile = getLibraryFileToFileFromNode(sectionNode.data as TreeNode);
			const actualPath = getTreePathFromLibraryFile(libraryFile);

			expect(actualPath).toEqual(expectedPath);
		});

		it('should round-trip Page node with multi-level path correctly', () => {
			const tree = new LibraryTree(
				[
					{
						pageStatuses: {
							'005': TextStatus.NotStarted,
							'010': TextStatus.Done,
						},
						path: ['Book', 'Chapter', 'Section', 'Text'] as TreePath,
					},
				],
				'Library'
			);

			const textNode = tree.getMaybeNode({
				path: ['Book', 'Chapter', 'Section', 'Text'],
			});
			expect(textNode.error).toBe(false);
			if (textNode.error) return;

			const pageNode = (textNode.data).type === 'Text'
				? (textNode.data).children.find((p) => p.name === '005')
				: null;

			expect(pageNode).not.toBeNull();
			if (!pageNode) return;

			const expectedPath = getTreePathFromNode(pageNode);
			const libraryFile = getLibraryFileToFileFromNode(pageNode);
			const actualPath = getTreePathFromLibraryFile(libraryFile);

			expect(actualPath).toEqual(expectedPath);
		});

		it('should handle Unknown fileType correctly', () => {
			const libraryFile = {
				fullPath: {
					basename: 'some-file',
					extension: 'md',
					pathParts: ['Folder1', 'Folder2'],
					type: 'file' as const,
				},
				metaInfo: {
					fileType: 'Unknown' as const,
					status: TextStatus.NotStarted,
				},
			};

			const actualPath = getTreePathFromLibraryFile(libraryFile);
			expect(actualPath).toEqual(['Folder1', 'Folder2', 'some-file']);
		});
	});
});
