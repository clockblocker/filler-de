/**
 * Builds VaultActions for page splitting operation.
 */

import { MD } from "@textfresser/vault-action-manager/types/literals";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { SplitPathKind } from "@textfresser/vault-action-manager/types/split-path";
import type { VaultAction } from "@textfresser/vault-action-manager/types/vault-action";
import { VaultActionKind } from "@textfresser/vault-action-manager/types/vault-action";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import type { CodecRules } from "@textfresser/library-core/codecs/rules";
import { serializeSegmentId } from "@textfresser/library-core/codecs/segment-id/internal/serialize";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "@textfresser/library-core/codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "@textfresser/library-core/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "@textfresser/library-core/types/schemas/node-name";
import { buildPageBasename, buildPageFolderBasename } from "./page-codec";
import type { SegmentationResult } from "./types";
import { PAGE_FRONTMATTER, PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

export type PageSplitResult = {
	actions: VaultAction[];
	firstPagePath: SplitPathToMdFile;
	/** Section chain for the newly created folder (for Librarian notification) */
	sectionChain: SectionNodeSegmentId[];
	/** Segment ID of the deleted scroll (for tree update) */
	deletedScrollSegmentId: ScrollNodeSegmentId;
	/** Node names of created pages (e.g., "Aschenputtel_Page_000") */
	pageNodeNames: string[];
};

/**
 * Builds all VaultActions needed for page splitting.
 *
 * @param result - Segmentation result with pages
 * @param sourcePath - Original file's split path
 * @param rules - Codec rules for naming
 * @returns Actions and first page path
 */
export function buildPageSplitActions(
	result: SegmentationResult,
	sourcePath: SplitPathToMdFile,
	rules: CodecRules,
): PageSplitResult {
	const actions: VaultAction[] = [];

	// Calculate folder path - VAM auto-creates folders
	const folderBasename = buildPageFolderBasename(result.sourceCoreName);
	const newPathParts = [...sourcePath.pathParts, folderBasename];

	// Build section chain for the new folder (all path parts including the new folder)
	const sectionChain = buildSectionChainFromPathParts(newPathParts);

	// Build segment ID for the deleted scroll (same coreName, but Scroll kind)
	const deletedScrollSegmentId = serializeSegmentId({
		coreName: result.sourceCoreName,
		extension: MD,
		targetKind: TreeNodeKind.Scroll,
	}) as ScrollNodeSegmentId;

	// 1. Create pages (always at least one when this function is called)
	// Note: VAM auto-creates folders when creating files inside them
	// Note: Codex is created by Librarian based on page creation events
	const firstPagePath = buildPageSplitPath(
		0,
		result.sourceCoreName,
		result.sourceSuffix,
		newPathParts,
		rules,
	);

	for (const page of result.pages) {
		// Pages from segmentContentWithBlockMarkers already have block markers.
		const pageContent = formatPageContent(page.content);

		const pagePath =
			page.pageIndex === 0
				? firstPagePath
				: buildPageSplitPath(
						page.pageIndex,
						result.sourceCoreName,
						result.sourceSuffix,
						newPathParts,
						rules,
					);

		actions.push({
			kind: VaultActionKind.UpsertMdFile,
			payload: {
				content: pageContent,
				splitPath: pagePath,
			},
		});
	}

	// 3. Trash source file
	actions.push({
		kind: VaultActionKind.TrashMdFile,
		payload: { splitPath: sourcePath },
	});

	// 4. Extract page node names for tree population
	const pageNodeNames = result.pages.map((page) => {
		const paddedIndex = String(page.pageIndex).padStart(
			PAGE_INDEX_DIGITS,
			"0",
		);
		return `${result.sourceCoreName}_${PAGE_PREFIX}_${paddedIndex}`;
	});

	return {
		actions,
		deletedScrollSegmentId,
		firstPagePath,
		pageNodeNames,
		sectionChain,
	};
}

/**
 * Builds a SplitPath for a page file.
 */
function buildPageSplitPath(
	pageIndex: number,
	coreName: NodeName,
	suffixParts: NodeName[],
	pathParts: string[],
	rules: CodecRules,
): SplitPathToMdFile {
	const basename = buildPageBasename(pageIndex, coreName, suffixParts, rules);
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

/**
 * Formats page content with page metadata.
 * Uses upsertMetadata to respect hideMetadata setting.
 */
function formatPageContent(content: string): string {
	// Transform is synchronous here, cast is safe
	const metadata: Record<string, unknown> = {
		noteKind: PAGE_FRONTMATTER.noteKind,
		status: PAGE_FRONTMATTER.status,
	};
	return noteMetadataHelper.upsert(metadata)(content) as string;
}

/**
 * Builds section chain (segment IDs) from path parts (node names).
 * Each path part becomes a section segment ID.
 */
export function buildSectionChainFromPathParts(
	pathParts: string[],
): SectionNodeSegmentId[] {
	return pathParts.map(
		(nodeName) =>
			serializeSegmentId({
				coreName: nodeName as NodeName,
				targetKind: TreeNodeKind.Section,
			}) as SectionNodeSegmentId,
	);
}
