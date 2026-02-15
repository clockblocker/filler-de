/**
 * Migration for page navigation indices.
 *
 * Detects Page notes missing prevPageIdx/nextPageIdx and generates
 * ProcessMdFile actions to add the indices based on sibling pages.
 */

import { z } from "zod";
import type {
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { parsePageIndex } from "../bookkeeper/page-codec";
import { parseSeparatedSuffix } from "../codecs/internal/suffix/parse";
import type { CodecRules } from "../codecs/rules";

/** Schema for reading page metadata */
const PageMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
		status: z.string().optional(),
	})
	.passthrough();

type PageInfo = {
	splitPath: SplitPathToMdFile;
	pageIndex: number;
	coreName: string;
	hasPrevIdx: boolean;
	hasNextIdx: boolean;
	needsNoteKind: boolean;
};

/**
 * Build migration actions for pages missing navigation indices.
 *
 * @param files - All files in the library with readers
 * @param rules - Codec rules for building vault-scoped paths
 * @returns VaultActions to add missing indices
 */
export async function buildPageNavMigrationActions(
	files: SplitPathWithReader[],
	rules: CodecRules,
): Promise<VaultAction[]> {
	const migrationActions: VaultAction[] = [];

	// Group pages by their parent folder + coreName
	const pageGroups = new Map<string, PageInfo[]>();

	for (const file of files) {
		if (file.kind !== SplitPathKind.MdFile || !("read" in file)) continue;

		// Parse suffix to extract coreName before checking page pattern
		const suffixResult = parseSeparatedSuffix(rules, file.basename);
		if (suffixResult.isErr()) continue;
		const { coreName } = suffixResult.value;

		// Check if this is a page file by coreName pattern
		const parseResult = parsePageIndex(coreName);
		if (!parseResult.isPage) continue;

		// Read content to check metadata
		const contentResult = await file.read();
		if (contentResult.isErr()) continue;

		const content = contentResult.value;
		const metadata = noteMetadataHelper.read(content, PageMetadataSchema);

		// Page files identified by filename pattern, not by noteKind
		// Initialize missing/partial metadata
		const normalizedMeta = metadata ?? {};

		// Build group key: folder path + page coreName (from parsePageIndex)
		const folderPath = file.pathParts.join("/");
		const groupKey = `${folderPath}/${parseResult.coreName}`;

		// Build vault-scoped split path
		const vaultPath: SplitPathToMdFile = {
			basename: file.basename,
			extension: file.extension,
			kind: SplitPathKind.MdFile,
			pathParts: [...rules.libraryRootPathParts, ...file.pathParts],
		};

		const pageInfo: PageInfo = {
			coreName: parseResult.coreName,
			hasNextIdx: normalizedMeta.nextPageIdx !== undefined,
			hasPrevIdx: normalizedMeta.prevPageIdx !== undefined,
			needsNoteKind: normalizedMeta.noteKind !== "Page",
			pageIndex: parseResult.pageIndex,
			splitPath: vaultPath,
		};

		if (!pageGroups.has(groupKey)) {
			pageGroups.set(groupKey, []);
		}
		pageGroups.get(groupKey)?.push(pageInfo);
	}

	// Process each group to compute and add missing indices
	for (const [_groupKey, pages] of pageGroups) {
		// Sort by page index
		pages.sort((a, b) => a.pageIndex - b.pageIndex);

		const totalPages = pages.length;
		if (totalPages === 0) continue;

		// Check each page for missing indices
		for (let i = 0; i < totalPages; i++) {
			const page = pages[i];
			if (!page) continue;

			// Compute expected indices
			const expectedPrevIdx = i > 0 ? pages[i - 1]?.pageIndex : undefined;
			const expectedNextIdx =
				i < totalPages - 1 ? pages[i + 1]?.pageIndex : undefined;

			// Check if migration is needed
			const needsPrev = expectedPrevIdx !== undefined && !page.hasPrevIdx;
			const needsNext = expectedNextIdx !== undefined && !page.hasNextIdx;
			const needsNoteKind = page.needsNoteKind;

			if (needsPrev || needsNext || needsNoteKind) {
				migrationActions.push({
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						splitPath: page.splitPath,
						transform: (content: string) => {
							// Read existing metadata (may be null/partial)
							const existing =
								noteMetadataHelper.read(
									content,
									PageMetadataSchema,
								) ?? {};

							// Build updated metadata with noteKind always set
							const updated: Record<string, unknown> = {
								...existing,
								noteKind: "Page", // Always ensure noteKind is set
							};
							if (needsPrev && expectedPrevIdx !== undefined) {
								updated.prevPageIdx = expectedPrevIdx;
							}
							if (needsNext && expectedNextIdx !== undefined) {
								updated.nextPageIdx = expectedNextIdx;
							}

							// Apply metadata update
							return noteMetadataHelper.upsert(updated)(
								content,
							) as string;
						},
					},
				});
			}
		}
	}

	return migrationActions;
}
