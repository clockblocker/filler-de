import { err, ok, type Result } from "neverthrow";
import {
	type SplitPath,
	type SplitPathToFile,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../types/schemas/node-name";
import { tryMakeSeparatedSuffixedBasename } from "../suffix-utils/suffix-utils";
import type {
	CanonicalSplitPath,
	CanonicalSplitPathToFile,
	CanonicalSplitPathToFolder,
	CanonicalSplitPathToMdFile,
} from "./types";

export function tryParseCanonicalSplitPath(
	sp: SplitPath,
): Result<CanonicalSplitPath, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathToFolder,
): Result<CanonicalSplitPathToFolder, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathToFile,
): Result<CanonicalSplitPathToFile, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPathToMdFile,
): Result<CanonicalSplitPathToMdFile, string>;
export function tryParseCanonicalSplitPath(
	sp: SplitPath,
): Result<CanonicalSplitPath, string> {
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
 * - All parts (`nodeName`, suffix parts, sectionNames) must be valid `NodeName`s.
 *
 * If valid, returns a canonical file split path with normalized `NodeName`s.
 */
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToMdFile,
): Result<CanonicalSplitPathToMdFile, string>;
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToFile,
): Result<CanonicalSplitPathToFile, string>;
function tryParseCanonicalSplitPathToFile(
	sp: SplitPathToFile | SplitPathToMdFile,
): Result<CanonicalSplitPathToFile | CanonicalSplitPathToMdFile, string> {
	// parse nodeName + suffixParts from basename
	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);
	const { nodeName, suffixParts } = sepRes.value;

	// parse sectionNames from pathParts
	const sectionNamesRes = tryParseSectionNamesFromPathParts(sp.pathParts);
	if (sectionNamesRes.isErr()) return err(sectionNamesRes.error);
	const sectionNames = sectionNamesRes.value;

	// canonical check: suffixParts === sectionNames.reverse()
	const expectedSuffix = [...sectionNames].reverse();
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
	sp: SplitPathToFolder,
): Result<CanonicalSplitPathToFolder, string> {
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
): Result<CanonicalSplitPath["sectionNames"], string> {
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
