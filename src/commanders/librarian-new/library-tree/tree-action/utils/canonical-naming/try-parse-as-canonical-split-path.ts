import { err, ok, type Result } from "neverthrow";
import type { SplitPath } from "../../../../../../obsidian-vault-action-manager/types/split-path";
import { NodeNameSchema } from "../../../../types/schemas/node-name";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import {
	makeJoinedSuffixedBasename,
	tryMakeSeparatedSuffixedBasename,
} from "../suffix-utils/suffix-utils";
import { buildCanonicalSeparatedSuffixedBasenamePathKingWay } from "./build-canonical-separated-suffixed-basename";
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

	const expectedBasename = makeJoinedSuffixedBasename(
		buildCanonicalSeparatedSuffixedBasenamePathKingWay(sp)
			.separatedSuffixedBasename,
	);

	if (actualBasename !== expectedBasename) {
		return err("Basename does not match canonical format");
	}

	return ok({
		...sp,
		separatedSuffixedBasename: {
			coreName,
			suffixParts,
		},
	});
}

function tryParsePathParts(
	pathParts: SplitPath["pathParts"],
): Result<SplitPath["pathParts"], string> {
	for (const p of pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(r.error.issues[0]?.message ?? "Invalid path part");
		}
	}
	return ok(pathParts);
}
