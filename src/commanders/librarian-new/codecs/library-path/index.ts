/**
 * Unified LibraryPath type for path operations within the library.
 * Provides a cleaner abstraction over SplitPath for internal use.
 */

import { err, ok, type Result } from "neverthrow";
import type { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind as SplitPathKindEnum } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../errors";
import type { SegmentIdCodecs } from "../segment-id";
import type { SectionNodeSegmentId } from "../segment-id/types/segment-id";
import type {
	AnySplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../split-path-inside-library";

// ─── Types ───

/**
 * Unified path representation within the library.
 * Immutable and serialization-friendly (no getters).
 */
export type LibraryPath = {
	/** Path segments from root, e.g., ["Library", "parent", "child"] */
	readonly segments: readonly string[];
	/** File extension if this is a file, undefined for folders */
	readonly extension?: string;
	/** SplitPath kind for compatibility */
	readonly kind: SplitPathKind;
};

// ─── Utility Functions ───

/**
 * Get suffix parts for a library path.
 * Suffix = segments excluding root, reversed.
 * E.g., ["Library", "grandpa", "father"] → ["father", "grandpa"]
 */
export function getSuffixParts(p: LibraryPath): string[] {
	if (p.segments.length <= 1) {
		return [...p.segments]; // Root only
	}
	return p.segments.slice(1).reverse();
}

/**
 * Get the basename (last segment) of a library path.
 */
export function getBasename(p: LibraryPath): string {
	return p.segments[p.segments.length - 1] ?? "";
}

/**
 * Get parent path parts (all segments except the last).
 */
export function getParentPathParts(p: LibraryPath): string[] {
	return p.segments.slice(0, -1) as string[];
}

/**
 * Convert LibraryPath to AnySplitPathInsideLibrary.
 * Used at boundaries when interfacing with VaultActionManager.
 */
export function toSplitPath(p: LibraryPath): AnySplitPathInsideLibrary {
	const pathParts = getParentPathParts(p);
	const basename = getBasename(p);

	if (p.kind === SplitPathKindEnum.Folder) {
		return {
			basename,
			kind: SplitPathKindEnum.Folder,
			pathParts,
		} as SplitPathToFolderInsideLibrary;
	}
	if (p.kind === SplitPathKindEnum.MdFile) {
		return {
			basename,
			extension: "md" as const,
			kind: SplitPathKindEnum.MdFile,
			pathParts,
		} as SplitPathToMdFileInsideLibrary;
	}
	// File
	return {
		basename,
		extension: p.extension ?? "",
		kind: SplitPathKindEnum.File,
		pathParts,
	} as SplitPathToFileInsideLibrary;
}

/**
 * Create LibraryPath from SplitPath.
 */
export function fromSplitPath(sp: AnySplitPathInsideLibrary): LibraryPath {
	const segments = [...sp.pathParts, sp.basename];
	return {
		extension: "extension" in sp ? sp.extension : undefined,
		kind: sp.kind,
		segments,
	};
}

/**
 * Create LibraryPath from section chain.
 */
export function fromSectionChain(
	chain: SectionNodeSegmentId[],
	segmentIdCodecs: SegmentIdCodecs,
): Result<LibraryPath, CodecError> {
	const segments: string[] = [];

	for (const segId of chain) {
		const parseResult = segmentIdCodecs.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			return err(parseResult.error);
		}
		segments.push(parseResult.value.coreName);
	}

	return ok({
		extension: undefined,
		kind: SplitPathKindEnum.Folder,
		segments,
	});
}

/**
 * Create a LibraryPath for a leaf (scroll/file) in a section.
 */
export function makeLeafPath(
	parentSegments: readonly string[],
	leafName: string,
	extension: string,
): LibraryPath {
	const isMd = extension === "md";
	return {
		extension,
		kind: isMd ? SplitPathKindEnum.MdFile : SplitPathKindEnum.File,
		segments: [...parentSegments, leafName],
	};
}

/**
 * Create a LibraryPath for a section/folder.
 */
export function makeSectionPath(segments: readonly string[]): LibraryPath {
	return {
		extension: undefined,
		kind: SplitPathKindEnum.Folder,
		segments,
	};
}

// ─── Codecs Interface ───

export type LibraryPathCodecs = {
	fromSplitPath: typeof fromSplitPath;
	fromSectionChain: typeof fromSectionChain;
	toSplitPath: typeof toSplitPath;
	getSuffixParts: typeof getSuffixParts;
	getBasename: typeof getBasename;
	getParentPathParts: typeof getParentPathParts;
	makeLeafPath: typeof makeLeafPath;
	makeSectionPath: typeof makeSectionPath;
};

export function makeLibraryPathCodecs(
	segmentIdCodecs: SegmentIdCodecs,
): LibraryPathCodecs {
	return {
		fromSectionChain: (chain) => fromSectionChain(chain, segmentIdCodecs),
		fromSplitPath,
		getBasename,
		getParentPathParts,
		getSuffixParts,
		makeLeafPath,
		makeSectionPath,
		toSplitPath,
	};
}
