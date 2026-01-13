import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type { AnySplitPath } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	AnySplitPathInsideLibrary,
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../codecs";
import { makeCodecs, makeCodecRulesFromSettings } from "../../../../../codecs";
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import {
	buildCanonicalSeparatedSuffixedBasename,
	canonizeSplitPathWithSeparatedSuffix,
} from "../../../../../codecs/canonical-split-path/internal/canonicalization-policy";
import {
	makeJoinedSuffixedBasename,
	tryParseAsSeparatedSuffixedBasename,
} from "./suffix-utils/core-suffix-utils";

export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToFolderInsideLibrary,
): Result<CanonicalSplitPathToFolderInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToFileInsideLibrary,
): Result<CanonicalSplitPathToFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToMdFileInsideLibrary,
): Result<CanonicalSplitPathToMdFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string> {
	const pathPartsRes = tryParsePathParts(sp.pathParts);
	if (pathPartsRes.isErr()) return err(pathPartsRes.error);

	const sepRes = tryParseAsSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	// Create codecs for policy functions
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);

	// Convert to separated suffix format using new codec
	const withSeparatedSuffixResult =
		codecs.canonicalSplitPath.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		);
	if (withSeparatedSuffixResult.isErr()) {
		return err(withSeparatedSuffixResult.error.message);
	}

	// Build expected canonical from pathParts (policy)
	const expected = buildCanonicalSeparatedSuffixedBasename(
		codecs.canonicalSplitPath as unknown as Parameters<
			typeof buildCanonicalSeparatedSuffixedBasename
		>[0],
		rules.libraryRootName,
		sepRes.value.coreName,
		sp,
	);

	// Update suffixParts to match canonical
	const spWithSeparatedSuffix = {
		...withSeparatedSuffixResult.value,
		separatedSuffixedBasename: expected.separatedSuffixedBasename,
	};

	// Canonize using policy (validates format)
	const canonizedResult = canonizeSplitPathWithSeparatedSuffix(
		codecs.canonicalSplitPath as unknown as Parameters<
			typeof canonizeSplitPathWithSeparatedSuffix
		>[0],
		rules.libraryRootName,
		spWithSeparatedSuffix,
	);
	if (canonizedResult.isErr()) {
		return err(canonizedResult.error.message);
	}

	return ok(canonizedResult.value);
}

function tryParsePathParts(
	pathParts: AnySplitPath["pathParts"],
): Result<AnySplitPath["pathParts"], string> {
	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const libraryRootName = splitPathToLibraryRoot.basename;

	// Empty pathParts is allowed only for Library root folder
	if (pathParts.length === 0) {
		return ok(pathParts);
	}

	// Non-empty pathParts must start with Library
	if (pathParts[0] !== libraryRootName) return err("ExpectedLibraryRoot");

	for (const p of pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(r.error.issues[0]?.message ?? "Invalid path part");
		}
	}
	return ok(pathParts);
}

export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFolderInsideLibrary,
): SplitPathToFolderInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFileInsideLibrary,
): SplitPathToFileInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): SplitPathToMdFileInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): AnySplitPathInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): AnySplitPathInsideLibrary {
	const basename = makeJoinedSuffixedBasename(sp.separatedSuffixedBasename);
	return {
		...sp,
		basename,
	};
}
