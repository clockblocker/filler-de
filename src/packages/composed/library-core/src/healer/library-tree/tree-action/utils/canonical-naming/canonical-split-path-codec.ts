import type { AnySplitPath } from "@textfresser/vault-action-manager";
import { Result } from "effect";
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
): Result.Result<CanonicalSplitPathToFolderInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToFileInsideLibrary,
	codecs: Codecs,
): Result.Result<CanonicalSplitPathToFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): Result.Result<CanonicalSplitPathToMdFileInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
	codecs: Codecs,
): Result.Result<AnyCanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: AnySplitPathInsideLibrary,
	codecs: Codecs,
): Result.Result<AnyCanonicalSplitPathInsideLibrary, string> {
	const { rules } = codecs;
	const pathPartsRes = tryParsePathParts(sp.pathParts, codecs);
	if (Result.isFailure(pathPartsRes))
		return Result.fail(pathPartsRes.failure);

	// Convert to separated suffix format using new codec
	const withSeparatedSuffixResult =
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		);
	if (Result.isFailure(withSeparatedSuffixResult)) {
		return Result.fail(withSeparatedSuffixResult.failure.message);
	}

	// Use actual separated suffix from codec (contains parsed basename)
	const actualSeparatedSuffix = withSeparatedSuffixResult.success;

	// Canonize using policy (validates format by comparing actual with expected)
	const canonizedResult = canonizeSplitPathWithSeparatedSuffix(
		codecs.suffix,
		rules.libraryRootName,
		actualSeparatedSuffix,
	);

	if (Result.isFailure(canonizedResult)) {
		return Result.fail(canonizedResult.failure.message);
	}

	return Result.succeed(
		canonizedResult.success as AnyCanonicalSplitPathInsideLibrary,
	);
}

function tryParsePathParts(
	pathParts: AnySplitPath["pathParts"],
	codecs: Codecs,
): Result.Result<AnySplitPath["pathParts"], string> {
	const { libraryRootName, suffixDelimiterPattern } = codecs.rules;

	// Empty pathParts is allowed only for Library root folder
	if (pathParts.length === 0) {
		return Result.succeed(pathParts);
	}

	// Non-empty pathParts must start with Library
	if (pathParts[0] !== libraryRootName)
		return Result.fail("ExpectedLibraryRoot");

	const nameSchema = nodeNameSchema(suffixDelimiterPattern);
	for (const p of pathParts) {
		const r = nameSchema.safeParse(p);
		if (!r.success) {
			return Result.fail(
				r.error.issues[0]?.message ?? "Invalid path part",
			);
		}
	}
	return Result.succeed(pathParts);
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
