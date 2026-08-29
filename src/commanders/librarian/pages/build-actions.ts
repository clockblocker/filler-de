/**
 * Builds VaultActions for page splitting operation.
 */

import {
	type CodecRules,
	makeLibraryScope,
	makeNodeSegmentId,
	type NodeName,
	type SectionNodeSegmentId,
	type TreeAction,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Schema } from "effect";
import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { buildPageBasename, buildPageFolderBasename } from "./page-codec";
import type { SegmentationResult } from "./types";
import { PAGE_FRONTMATTER, PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

const PageSplitPlanBrand: unique symbol = Symbol("PageSplitPlan");

export type PageSplitPlan = {
	readonly [PageSplitPlanBrand]: true;
	readonly firstPagePath: SplitPathToMdFile;
	readonly treeActions: readonly TreeAction[];
	readonly vaultActions: readonly VaultAction[];
};

export class PageSplitPlanningError extends Schema.TaggedError<PageSplitPlanningError>()(
	"PageSplitPlanningError",
	{
		kind: Schema.Literal("PathOutsideLibrary"),
		path: Schema.Struct({
			basename: Schema.String,
			extension: Schema.Literal(MD),
			kind: Schema.Literal(SplitPathKind.MdFile),
			pathParts: Schema.Array(Schema.String),
		}),
	},
) {}

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
): Result<PageSplitPlan, PageSplitPlanningError> {
	const vaultActions: VaultAction[] = [];
	const libraryScope = makeLibraryScope(rules);
	const librarySourcePath = libraryScope.toLibraryPath(sourcePath);
	if (librarySourcePath.isErr()) {
		return err(
			new PageSplitPlanningError({
				kind: "PathOutsideLibrary",
				path: sourcePath,
			}),
		);
	}

	// Calculate folder path - VAM auto-creates folders
	const folderBasename = buildPageFolderBasename(result.sourceCoreName);
	const newPathParts = [...sourcePath.pathParts, folderBasename];

	// Build section chain for the new folder (all path parts including the new folder)
	const deletedScrollSegmentId = makeNodeSegmentId({
		extension: MD,
		kind: TreeNodeKind.Scroll,
		nodeName: result.sourceCoreName,
		status: TreeNodeStatus.NotStarted,
	});
	const treeActions: TreeAction[] = [
		{
			actionType: "Delete",
			targetLocator: {
				segmentId: deletedScrollSegmentId,
				segmentIdChainToParent: buildSectionChainFromPathParts(
					librarySourcePath.value.pathParts,
				),
				targetKind: TreeNodeKind.Scroll,
			},
		},
	];

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
		const libraryPagePath = libraryScope.toLibraryPath(pagePath);
		if (libraryPagePath.isErr()) {
			return err(
				new PageSplitPlanningError({
					kind: "PathOutsideLibrary",
					path: pagePath,
				}),
			);
		}

		vaultActions.push({
			kind: VaultActionKind.UpsertMdFile,
			payload: {
				content: pageContent,
				splitPath: pagePath,
			},
		});

		const paddedIndex = String(page.pageIndex).padStart(
			PAGE_INDEX_DIGITS,
			"0",
		);
		const pageNodeName =
			`${result.sourceCoreName}_${PAGE_PREFIX}_${paddedIndex}` as NodeName;
		treeActions.push({
			actionType: "Create",
			initialStatus: TreeNodeStatus.NotStarted,
			observedSplitPath: libraryPagePath.value,
			targetLocator: {
				segmentId: makeNodeSegmentId({
					extension: MD,
					kind: TreeNodeKind.Scroll,
					nodeName: pageNodeName,
					status: TreeNodeStatus.NotStarted,
				}),
				segmentIdChainToParent: buildSectionChainFromPathParts(
					libraryPagePath.value.pathParts,
				),
				targetKind: TreeNodeKind.Scroll,
			},
		});
	}

	// 3. Trash source file
	vaultActions.push({
		kind: VaultActionKind.TrashMdFile,
		payload: { splitPath: sourcePath },
	});

	return ok({
		[PageSplitPlanBrand]: true,
		firstPagePath,
		treeActions,
		vaultActions,
	});
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
function buildSectionChainFromPathParts(
	pathParts: string[],
): SectionNodeSegmentId[] {
	return pathParts.map(
		(nodeName) =>
			makeNodeSegmentId({
				children: {},
				kind: TreeNodeKind.Section,
				nodeName: nodeName as NodeName,
			}) as SectionNodeSegmentId,
	);
}
