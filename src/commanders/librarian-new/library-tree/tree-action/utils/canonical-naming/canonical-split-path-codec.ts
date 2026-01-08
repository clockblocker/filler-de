import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../global-state/global-state";
import type { SplitPath } from "../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { NodeNameSchema } from "../../../../types/schemas/node-name";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import { tryBuildCanonicalSeparatedSuffixedBasename } from "./suffix-utils/build-canonical-separated-suffixed-basename-path-king-way";
import {
	makeJoinedSuffixedBasename,
	tryMakeSeparatedSuffixedBasename,
} from "./suffix-utils/core-suffix-utils";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "./types";

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
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string>;
export function tryParseCanonicalSplitPathInsideLibrary(
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string> {
	const pathPartsRes = tryParsePathParts(sp.pathParts);
	if (pathPartsRes.isErr()) return err(pathPartsRes.error);

	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
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
	pathParts: SplitPath["pathParts"],
): Result<SplitPath["pathParts"], string> {
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
): SplitPathInsideLibrary;
export function makeRegularSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): SplitPathInsideLibrary {
	const basename = makeJoinedSuffixedBasename(sp.separatedSuffixedBasename);
	return {
		...sp,
		basename,
	};
}
