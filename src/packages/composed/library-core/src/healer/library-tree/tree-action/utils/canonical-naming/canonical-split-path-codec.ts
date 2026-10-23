import type { AnySplitPath } from "@textfresser/vault-action-manager";
import { err, ok, type Result } from "neverthrow";
import type {
	AnyCanonicalSplitPathInsideLibrary,
	AnySplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../codecs";
import { nodeNameSchema } from "../../../../../types/schemas/node-name";
import { canonizeSplitPathWithSeparatedSuffix } from "./canonicalization-policy";

export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToFolderInsideLibrary,
	codecs: Codecs,
): Result<CanonicalSplitPathToFolderInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToFileInsideLibrary,
	codecs: Codecs,
): Result<CanonicalSplitPathToFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): Result<CanonicalSplitPathToMdFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
	codecs: Codecs,
): Result<AnyCanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
	codecs: Codecs,
): Result<AnyCanonicalSplitPathInsideLibrary, string> {
	const { rules } = codecs;
	const pathPartsRes = tryParsePathParts(sp.pathParts, codecs);
	if (pathPartsRes.isErr()) return err(pathPartsRes.error);

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
	codecs: Codecs,
): Result<AnySplitPath["pathParts"], string> {
	const { libraryRootName, suffixDelimiterPattern } = codecs.rules;

	// Empty pathParts is allowed only for Library root folder
	if (pathParts.length === 0) {
		return ok(pathParts);
	}

	// Non-empty pathParts must start with Library
	if (pathParts[0] !== libraryRootName) return err("ExpectedLibraryRoot");

	const nameSchema = nodeNameSchema(suffixDelimiterPattern);
	for (const p of pathParts) {
		const r = nameSchema.safeParse(p);
		if (!r.success) {
			return err(r.error.issues[0]?.message ?? "Invalid path part");
		}
	}
	return ok(pathParts);
}

export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFolderInsideLibrary,
	codecs: Codecs,
): SplitPathToFolderInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFileInsideLibrary,
	codecs: Codecs,
): SplitPathToFileInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: AnyCanonicalSplitPathInsideLibrary,
	codecs: Codecs,
): AnySplitPathInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: AnyCanonicalSplitPathInsideLibrary,
	codecs: Codecs,
): AnySplitPathInsideLibrary {
	const basename = codecs.suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);
	return {
		...sp,
		basename,
	};
}
