import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type { AnySplitPath } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	AnyCanonicalSplitPathInsideLibrary,
	AnySplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../codecs";
import { makeCodecRulesFromSettings, makeCodecs } from "../../../../../codecs";
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import { canonizeSplitPathWithSeparatedSuffix } from "./canonicalization-policy";

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
): Result<AnyCanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
): Result<AnyCanonicalSplitPathInsideLibrary, string> {
	const pathPartsRes = tryParsePathParts(sp.pathParts);
	if (pathPartsRes.isErr()) return err(pathPartsRes.error);

	// Create codecs for policy functions
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);

	// Convert to separated suffix format using new codec
	const withSeparatedSuffixResult =
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		);
	if (withSeparatedSuffixResult.isErr()) {
		return err(withSeparatedSuffixResult.error.message);
	}

	// Use actual separated suffix from codec (contains parsed basename)
	const actualSeparatedSuffix = withSeparatedSuffixResult.value;

	// Canonize using policy (validates format by comparing actual with expected)
	const canonizedResult = canonizeSplitPathWithSeparatedSuffix(
		codecs.suffix,
		rules.libraryRootName,
		actualSeparatedSuffix,
	);

	if (canonizedResult.isErr()) {
		return err(canonizedResult.error.message);
	}

	return ok(canonizedResult.value as AnyCanonicalSplitPathInsideLibrary);
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
	sp: AnyCanonicalSplitPathInsideLibrary,
): AnySplitPathInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: AnyCanonicalSplitPathInsideLibrary,
): AnySplitPathInsideLibrary {
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);
	const basename = codecs.suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);
	return {
		...sp,
		basename,
	};
}
