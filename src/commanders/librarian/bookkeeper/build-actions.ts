/**
 * Builds VaultActions for page splitting operation.
 */

import { z } from "zod";
import { MD } from "../../../managers/obsidian/vault-action-manager/types/literals";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import {
	getContentBody,
	readMetadata,
	upsertMetadata,
} from "../../../stateless-helpers/note-metadata-service";
import { LINE_BREAK, SPACE_F } from "../../../types/literals";
import type { CodecRules } from "../codecs/rules";
import { serializeSegmentId } from "../codecs/segment-id/internal/serialize";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../codecs/segment-id/types/segment-id";
import { buildGoBackLink } from "../go-back-link";
import {
	TreeNodeKind,
	type TreeNodeStatus,
} from "../healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../types/schemas/node-name";
import { buildPageBasename, buildPageFolderBasename } from "./page-codec";
import { splitStrInBlocks } from "./segmenter/block-marker";
import type { SegmentationResult } from "./types";
import { PAGE_FRONTMATTER, PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

// Schema for reading existing page metadata
const PageMetadataSchema = z
	.object({
		noteKind: z.string().optional(),
		status: z.enum(["Done", "NotStarted"]).optional(),
	})
	.passthrough();

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
	const sectionChain = buildSectionChain(newPathParts);

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

	// Build go-back link to codex for all pages
	const codexBasename = buildCodexBasename(
		result.sourceCoreName,
		result.sourceSuffix,
		rules,
	);
	const goBackLink = buildGoBackLink(codexBasename, result.sourceCoreName);

	const totalPages = result.pages.length;
	for (const page of result.pages) {
		// Apply block markers to page content (each page resets at ^0)
		const { markedText } = splitStrInBlocks(page.content, 0);
		// Compute navigation indices
		const prevPageIdx = page.pageIndex > 0 ? page.pageIndex - 1 : undefined;
		const nextPageIdx =
			page.pageIndex < totalPages - 1 ? page.pageIndex + 1 : undefined;
		// Add go-back link at top, then formatted content with metadata
		const pageContent = formatPageContent(
			SPACE_F + goBackLink + LINE_BREAK + LINE_BREAK + markedText,
			prevPageIdx,
			nextPageIdx,
		);

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
 * Builds the codex basename.
 * Codex naming follows pattern: __-coreName-suffix
 */
function buildCodexBasename(
	coreName: NodeName,
	suffixParts: NodeName[],
	rules: CodecRules,
): string {
	const codexSuffixParts = [coreName, ...suffixParts];
	return ["__", ...codexSuffixParts].join(rules.suffixDelimiter);
}

/**
 * Formats page content with metadata including navigation indices.
 * Uses upsertMetadata to respect hideMetadata setting.
 *
 * @param content - The page content to format
 * @param prevPageIdx - Index of previous page (undefined if first page)
 * @param nextPageIdx - Index of next page (undefined if last page)
 */
function formatPageContent(
	content: string,
	prevPageIdx: number | undefined,
	nextPageIdx: number | undefined,
): string {
	// Transform is synchronous here, cast is safe
	const metadata: Record<string, unknown> = {
		noteKind: PAGE_FRONTMATTER.noteKind,
		status: PAGE_FRONTMATTER.status,
	};
	if (prevPageIdx !== undefined) {
		metadata.prevPageIdx = prevPageIdx;
	}
	if (nextPageIdx !== undefined) {
		metadata.nextPageIdx = nextPageIdx;
	}
	return upsertMetadata(metadata)(content) as string;
}

/**
 * Builds VaultAction to add noteKind metadata to a file that's too short to split.
 */
export function buildTooShortMetadataAction(
	sourcePath: SplitPathToMdFile,
): VaultAction {
	return {
		kind: VaultActionKind.ProcessMdFile,
		payload: {
			splitPath: sourcePath,
			transform: (content) => addPageFrontmatter(content),
		},
	};
}

/**
 * Adds noteKind: Page metadata to content.
 * Uses upsertMetadata to respect hideMetadata setting.
 */
function addPageFrontmatter(content: string): string {
	// Read existing metadata (from either format)
	const existing = readMetadata(content, PageMetadataSchema);

	// Build new metadata, preserving existing fields
	const meta = {
		...(existing ?? {}),
		noteKind: PAGE_FRONTMATTER.noteKind,
		status: (existing?.status as TreeNodeStatus) ?? PAGE_FRONTMATTER.status,
	};

	// Strip existing metadata and add new
	// Transforms are synchronous here, casts are safe
	const cleanContent = getContentBody()(content) as string;
	return upsertMetadata(meta)(cleanContent) as string;
}

/**
 * Builds section chain (segment IDs) from path parts (node names).
 * Each path part becomes a section segment ID.
 */
function buildSectionChain(pathParts: string[]): SectionNodeSegmentId[] {
	return pathParts.map(
		(nodeName) =>
			serializeSegmentId({
				coreName: nodeName as NodeName,
				targetKind: TreeNodeKind.Section,
			}) as SectionNodeSegmentId,
	);
}
