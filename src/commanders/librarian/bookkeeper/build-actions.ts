/**
 * Builds VaultActions for page splitting operation.
 */

import { z } from "zod";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import {
	getContentBody,
	readMetadata,
	upsertMetadata,
} from "../../../managers/pure/note-metadata-manager";
import {
	LINE_BREAK,
	NOT_STARTED_CHECKBOX,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../types/literals";
import type { CodecRules } from "../codecs/rules";
import type { TreeNodeStatus } from "../healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../types/schemas/node-name";
import { buildPageBasename, buildPageFolderBasename } from "./page-codec";
import type { SegmentationResult } from "./types";
import { PAGE_FRONTMATTER } from "./types";

// Schema for reading existing page metadata
const PageMetadataSchema = z
	.object({
		noteType: z.string().optional(),
		status: z.enum(["Done", "NotStarted"]).optional(),
	})
	.passthrough();

/**
 * Builds all VaultActions needed for page splitting.
 *
 * @param result - Segmentation result with pages
 * @param sourcePath - Original file's split path
 * @param rules - Codec rules for naming
 * @returns Array of VaultActions to execute
 */
export function buildPageSplitActions(
	result: SegmentationResult,
	sourcePath: SplitPathToMdFile,
	rules: CodecRules,
): VaultAction[] {
	const actions: VaultAction[] = [];

	// Calculate folder path
	const folderBasename = buildPageFolderBasename(result.sourceCoreName);
	const folderPath: SplitPathToFolder = {
		basename: folderBasename,
		kind: SplitPathKind.Folder,
		pathParts: sourcePath.pathParts,
	};

	// New path parts for items inside the folder
	const newPathParts = [...sourcePath.pathParts, folderBasename];

	// 1. Create folder
	actions.push({
		kind: VaultActionKind.CreateFolder,
		payload: { splitPath: folderPath },
	});

	// 2. Create codex
	const codexContent = generatePagesCodexContent(result, newPathParts, rules);
	const codexPath = buildCodexSplitPath(
		result.sourceCoreName,
		result.sourceSuffix,
		newPathParts,
		rules,
	);
	actions.push({
		kind: VaultActionKind.UpsertMdFile,
		payload: {
			content: codexContent,
			splitPath: codexPath,
		},
	});

	// 3. Create pages
	for (const page of result.pages) {
		const pageContent = formatPageContent(page.content);
		const pagePath = buildPageSplitPath(
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

	// 4. Trash source file
	actions.push({
		kind: VaultActionKind.TrashMdFile,
		payload: { splitPath: sourcePath },
	});

	return actions;
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
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

/**
 * Builds a SplitPath for the codex file.
 * Codex naming follows pattern: __-coreName-suffix
 */
function buildCodexSplitPath(
	coreName: NodeName,
	suffixParts: NodeName[],
	pathParts: string[],
	rules: CodecRules,
): SplitPathToMdFile {
	// Codex uses __ as core name with the source info as suffix
	const codexSuffixParts = [coreName, ...suffixParts];
	const basename = ["__", ...codexSuffixParts].join(rules.suffixDelimiter);
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

/**
 * Generates codex content listing all pages.
 */
function generatePagesCodexContent(
	result: SegmentationResult,
	pathParts: string[],
	rules: CodecRules,
): string {
	const lines: string[] = [];

	// Parent backlink (to parent folder's codex)
	const parentPathParts = pathParts.slice(0, -1);
	if (parentPathParts.length > 0) {
		const parentName = parentPathParts[parentPathParts.length - 1];
		if (parentName) {
			const parentCodexBasename = computeParentCodexBasename(
				parentPathParts,
				rules,
			);
			lines.push(formatBacklink(parentCodexBasename, `← ${parentName}`));
		}
	}

	// Page entries
	for (const page of result.pages) {
		const pageBasename = buildPageBasename(
			page.pageIndex,
			result.sourceCoreName,
			result.sourceSuffix,
			rules,
		);
		const displayName = `Page ${page.pageIndex + 1}`;
		const checkbox = NOT_STARTED_CHECKBOX;
		const link = formatBacklink(pageBasename, displayName);
		lines.push(`${checkbox}${SPACE_F}${link}`);
	}

	if (lines.length === 0) {
		return LINE_BREAK;
	}

	return (
		LINE_BREAK + lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
	);
}

/**
 * Computes parent codex basename.
 */
function computeParentCodexBasename(
	parentPathParts: string[],
	rules: CodecRules,
): string {
	// For parent codex, compute suffix from path
	// ["Library", "Märchen"] → "__-Märchen"
	// ["Library"] → "__-Library"
	const suffix =
		parentPathParts.length === 1
			? parentPathParts
			: parentPathParts.slice(1).reverse();
	return ["__", ...suffix].join(rules.suffixDelimiter);
}

/**
 * Formats a backlink.
 */
function formatBacklink(basename: string, displayName: string): string {
	return `${OBSIDIAN_LINK_OPEN}${basename}${PIPE}${displayName}${OBSIDIAN_LINK_CLOSE}`;
}

/**
 * Formats page content with metadata.
 * Uses upsertMetadata to respect hideMetadata setting.
 */
function formatPageContent(content: string): string {
	return upsertMetadata({
		noteType: PAGE_FRONTMATTER.noteType,
		status: PAGE_FRONTMATTER.status,
	})(content);
}

/**
 * Builds VaultAction to add noteType metadata to a file that's too short to split.
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
 * Adds noteType: Page metadata to content.
 * Uses upsertMetadata to respect hideMetadata setting.
 */
function addPageFrontmatter(content: string): string {
	// Read existing metadata (from either format)
	const existing = readMetadata(content, PageMetadataSchema);

	// Build new metadata, preserving existing fields
	const meta = {
		...(existing ?? {}),
		noteType: PAGE_FRONTMATTER.noteType,
		status: (existing?.status as TreeNodeStatus) ?? PAGE_FRONTMATTER.status,
	};

	// Strip existing metadata and add new
	const cleanContent = getContentBody()(content);
	return upsertMetadata(meta)(cleanContent);
}
