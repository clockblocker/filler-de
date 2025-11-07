import { describe, expect, it, mock } from 'bun:test';
import { Librarian } from '../../../src/commanders/librarian/librarian';
import type { PrettyFileWithReader } from '../../../src/services/obsidian-services/file-services/background/background-file-service';
import type { TexfresserObsidianServices } from '../../../src/services/obsidian-services/interface';
import { TextStatus } from '../../../src/types/common-interface/enums';
import { DASH, PAGE } from '../../../src/types/literals';
import { AVATAR_TEXTS } from '../static/batteries/avatar';

function makeMetaInfoContent(
	fileType: 'Page' | 'Scroll',
	index: number | undefined,
	status: TextStatus,
): string {
	if (fileType === 'Scroll') {
		return `<section id={textfresser_meta_keep_me_invisible}>
{"fileType":"${fileType}", "status":"${status}"}
</section>`;
	}
	return `<section id={textfresser_meta_keep_me_invisible}>
{"fileType":"${fileType}", "index":${index}, "status":"${status}"}
</section>`;
}

function createMockFileReader(
	basename: string,
	pathParts: readonly string[],
	content: string,
): PrettyFileWithReader {
	return {
		basename,
		pathParts: [...pathParts],
		readContent: async () => content,
	};
}

describe('Librarian.initTrees', () => {
	it('should initialize trees from mocked file readers', async () => {
		const mockGetReadersToAllMdFilesInFolder = mock(
			async (): Promise<PrettyFileWithReader[]> => {
				// Create mock file readers based on avatar structure
				// Episode_1 (ScrollNode - single page)
				// For ScrollNodes, basename is encoded as scroll name: path reversed joined with em dash
				const episode1Page = createMockFileReader(
					`Episode_1${DASH}Season_1${DASH}Avatar`,
					['Library', 'Avatar', 'Season_1', 'Episode_1'],
					makeMetaInfoContent('Scroll', undefined, TextStatus.NotStarted),
				);

				// Episode_2 (BookNode - multiple pages)
				// For Pages, basename format is: 000—path—reversed (using em dash)
				const episode2Page000 = createMockFileReader(
					`000${DASH}Episode_2${DASH}Season_1${DASH}Avatar`,
					['Library', 'Avatar', 'Season_1', 'Episode_2'],
					makeMetaInfoContent('Page', 0, TextStatus.NotStarted),
				);
				const episode2Page001 = createMockFileReader(
					`001${DASH}Episode_2${DASH}Season_1${DASH}Avatar`,
					['Library', 'Avatar', 'Season_1', 'Episode_2'],
					makeMetaInfoContent('Page', 1, TextStatus.NotStarted),
				);

				// Season_2 Episode_1 (ScrollNode)
				const season2Episode1Page = createMockFileReader(
					`Episode_1${DASH}Season_2${DASH}Avatar`,
					['Library', 'Avatar', 'Season_2', 'Episode_1'],
					makeMetaInfoContent('Scroll', undefined, TextStatus.NotStarted),
				);

				// Season_2 Episode_2 (ScrollNode)
				const season2Episode2Page = createMockFileReader(
					`Episode_2${DASH}Season_2${DASH}Avatar`,
					['Library', 'Avatar', 'Season_2', 'Episode_2'],
					makeMetaInfoContent('Scroll', undefined, TextStatus.NotStarted),
				);

				// Intro (root level, ScrollNode)
				const introPage = createMockFileReader(
					'Intro',
					['Library', 'Intro'],
					makeMetaInfoContent('Scroll', undefined, TextStatus.NotStarted),
				);

				return [
					episode1Page,
					episode2Page000,
					episode2Page001,
					season2Episode1Page,
					season2Episode2Page,
					introPage,
				];
			},
		);

		const mockBackgroundFileService = {
			getReadersToAllMdFilesInFolder: mockGetReadersToAllMdFilesInFolder,
		} as unknown as TexfresserObsidianServices['backgroundFileService'];

		const mockOpenedFileService = {} as TexfresserObsidianServices['openedFileService'];

		const mockApp = {
			vault: {
				on: mock(() => {}) as unknown as (event: string, callback: (...args: unknown[]) => void) => void,
			},
		} as unknown as Parameters<typeof Librarian.prototype.constructor>[0]['app'];

		const librarian = new Librarian({
			app: mockApp,
			backgroundFileService: mockBackgroundFileService,
			openedFileService: mockOpenedFileService,
		});

		await librarian.initTrees();

		// Verify that getReadersToAllMdFilesInFolder was called with "Library"
		expect(mockGetReadersToAllMdFilesInFolder).toHaveBeenCalledTimes(1);
		expect(mockGetReadersToAllMdFilesInFolder).toHaveBeenCalledWith({
			basename: 'Library',
			pathParts: [],
			type: 'folder',
		});

		// Verify that trees were created
		expect(librarian.trees).toBeDefined();
		expect(librarian.trees.Library).toBeDefined();

		// Verify tree structure matches expected avatar texts
		const tree = librarian.trees.Library;
		const allTexts = tree.getAllTextsInTree();


		// Should match AVATAR_TEXTS structure
		expect(allTexts.length).toBe(AVATAR_TEXTS.length);

		// Verify each expected text exists
		for (const expectedText of AVATAR_TEXTS) {
			const found = allTexts.find(
				(text) =>
					JSON.stringify(text.path) === JSON.stringify(expectedText.path) &&
					JSON.stringify(text.pageStatuses) ===
						JSON.stringify(expectedText.pageStatuses),
			);
			expect(found).toBeDefined();
		}
	});

	it('should handle empty folder', async () => {
		const mockGetReadersToAllMdFilesInFolder = mock(
			async (): Promise<PrettyFileWithReader[]> => {
				return [];
			},
		);

		const mockBackgroundFileService = {
			getReadersToAllMdFilesInFolder: mockGetReadersToAllMdFilesInFolder,
		} as unknown as TexfresserObsidianServices['backgroundFileService'];

		const mockOpenedFileService = {} as TexfresserObsidianServices['openedFileService'];

		const mockApp = {
			vault: {
				on: mock(() => {}) as unknown as (event: string, callback: (...args: unknown[]) => void) => void,
			},
		} as unknown as Parameters<typeof Librarian.prototype.constructor>[0]['app'];

		const librarian = new Librarian({
			app: mockApp,
			backgroundFileService: mockBackgroundFileService,
			openedFileService: mockOpenedFileService,
		});

		await librarian.initTrees();

		expect(librarian.trees).toBeDefined();
		// Empty folder should result in empty trees object
		expect(Object.keys(librarian.trees).length).toBe(0);
	});

	it('should filter out files without valid meta info', async () => {
		const mockGetReadersToAllMdFilesInFolder = mock(
			async (): Promise<PrettyFileWithReader[]> => {
				// Valid page file (ScrollNode format)
				const validPage = createMockFileReader(
					`ValidPage${DASH}Section`,
					['Library', 'Section', 'ValidPage'],
					makeMetaInfoContent('Scroll', undefined, TextStatus.NotStarted),
				);

				// File without meta info (should be filtered out)
				const invalidFile = createMockFileReader(
					`InvalidFile${DASH}Section`,
					['Library', 'Section', 'InvalidFile'],
					'No meta info here',
				);

				return [validPage, invalidFile];
			},
		);

		const mockBackgroundFileService = {
			getReadersToAllMdFilesInFolder: mockGetReadersToAllMdFilesInFolder,
		} as unknown as TexfresserObsidianServices['backgroundFileService'];

		const mockOpenedFileService = {} as TexfresserObsidianServices['openedFileService'];

		const mockApp = {
			vault: {
				on: mock(() => {}) as unknown as (event: string, callback: (...args: unknown[]) => void) => void,
			},
		} as unknown as Parameters<typeof Librarian.prototype.constructor>[0]['app'];

		const librarian = new Librarian({
			app: mockApp,
			backgroundFileService: mockBackgroundFileService,
			openedFileService: mockOpenedFileService,
		});

		await librarian.initTrees();

		const tree = librarian.trees.Library;
		expect(tree).toBeDefined();
		const allTexts = tree.getAllTextsInTree();

		// Should only have the valid page
		expect(allTexts.length).toBe(1);
		expect(allTexts[0]?.path).toEqual(['Section', 'ValidPage']);
	});
});

