import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../global-state/global-state";
import {
	type SplitPath,
	SplitPathType,
} from "../../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../types/schemas/node-name";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import { tryMakeSeparatedSuffixedBasename } from "../suffix-utils/suffix-utils";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "./types";

export function tryParseCanonicalSplitPath(
	sp: SplitPathToFolderInsideLibrary,
): Result<CanonicalSplitPathToFolderInsideLibrary, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathToFileInsideLibrary,
): Result<CanonicalSplitPathToFileInsideLibrary, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathToMdFileInsideLibrary,
): Result<CanonicalSplitPathToMdFileInsideLibrary, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string> {
	switch (sp.type) {
		case SplitPathType.File:
			return tryParseCanonicalSplitPathToFile(sp);
		case SplitPathType.Folder:
			return tryParseCanonicalSplitPathToFolder(sp);
		case SplitPathType.MdFile:
			return tryParseCanonicalSplitPathToFile(sp);
	}
}

// Helpers

/**
 * Canonical file rules:
 * - `basename` = `nodeName` + optional suffix.
 * - Suffix parts (if any) MUST equal `sectionNames.reverse()`.
 *   **Note**: The Library root (first segment) is excluded from suffix logic.
 * - All parts (`nodeName`, suffix parts, sectionNames) must be valid `NodeName`s.
 *
 * If valid, returns a canonical file split path with normalized `NodeName`s.
 */
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToMdFileInsideLibrary,
): Result<CanonicalSplitPathToMdFileInsideLibrary, string>;
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToFileInsideLibrary,
): Result<CanonicalSplitPathToFileInsideLibrary, string>;
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary,
): Result<
	| CanonicalSplitPathToFileInsideLibrary
	| CanonicalSplitPathToMdFileInsideLibrary,
	string
> {
	// parse nodeName + suffixParts from basename
	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);
	const { nodeName, suffixParts } = sepRes.value;

	// parse sectionNames from pathParts
	const sectionNamesRes = tryParseSectionNamesFromPathParts(sp.pathParts);
	if (sectionNamesRes.isErr()) return err(sectionNamesRes.error);
	const sectionNames = sectionNamesRes.value;

	// canonical check: suffixParts === sectionNames.reverse()
	// Exclude Library root (first segment) from suffix comparison
	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const libraryRootName = splitPathToLibraryRoot.basename;
	const sectionNamesForSuffix =
		sectionNames.length > 0 && sectionNames[0] === libraryRootName
			? sectionNames.slice(1)
			: sectionNames;
	const expectedSuffix = [...sectionNamesForSuffix].reverse();
	if (
		suffixParts.length !== expectedSuffix.length ||
		suffixParts.some((p, i) => p !== expectedSuffix[i])
	) {
		return err("File basename suffix does not match folder path");
	}

	return ok({
		...sp,
		nodeName,
		sectionNames,
	});
}

/**
 * Canonical folder rules:
 * - `basename` must be a valid `NodeName`.
 * - Every `pathPart` must be a valid `NodeName` (section name).
 * - Folder names never encode suffixes; no basename ↔ pathParts relation is checked.
 *
 * If valid, returns a canonical folder split path with normalized `NodeName`s.
 */
function tryParseCanonicalSplitPathToFolder(
	sp: SplitPathToFolderInsideLibrary,
): Result<CanonicalSplitPathToFolderInsideLibrary, string> {
	const nodeNameRes = NodeNameSchema.safeParse(sp.basename);
	if (!nodeNameRes.success) {
		return err(
			nodeNameRes.error.issues[0]?.message ?? "Invalid folder NodeName",
		);
	}

	const sectionNamesRes = tryParseSectionNamesFromPathParts(sp.pathParts);
	if (sectionNamesRes.isErr()) return err(sectionNamesRes.error);

	return ok({
		...sp,
		nodeName: nodeNameRes.data,
		sectionNames: sectionNamesRes.value,
	});
}

function tryParseSectionNamesFromPathParts(
	pathParts: SplitPath["pathParts"],
): Result<CanonicalSplitPathInsideLibrary["sectionNames"], string> {
	const sectionNames: NodeName[] = [];

	for (const p of pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(r.error.issues[0]?.message ?? "Invalid path part");
		}
		sectionNames.push(r.data);
	}

	return ok(sectionNames);
}
