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
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import { tryBuildCanonicalSeparatedSuffixedBasename } from "./suffix-utils/build-canonical-separated-suffixed-basename-path-king-way";
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

	const { coreName, suffixParts } = sepRes.value;

	const actualBasename = makeJoinedSuffixedBasename({
		coreName,
		suffixParts,
	});

	const canonicalRes = tryBuildCanonicalSeparatedSuffixedBasename(sp);
	if (canonicalRes.isErr()) return err(canonicalRes.error);

	const expectedBasename = makeJoinedSuffixedBasename(
		canonicalRes.value.separatedSuffixedBasename,
	);

	if (actualBasename !== expectedBasename) {
		return err("Basename does not match canonical format");
	}

	const out: CanonicalSplitPathInsideLibrary = {
		...sp,
		pathParts: pathPartsRes.value, // (assuming tryParsePathParts returns canonicalized parts)
		separatedSuffixedBasename: {
			coreName,
			suffixParts,
		},
	};

	return ok(out);
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
