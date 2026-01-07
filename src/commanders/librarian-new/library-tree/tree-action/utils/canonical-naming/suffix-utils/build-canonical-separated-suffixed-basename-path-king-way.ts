import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import { SplitPathType } from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import type { SplitPathInsideLibrary } from "../../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type {
	CanonicalSeparatedSuffixedBasename,
	CanonicalSplitPathInsideLibrary,
} from "../types";
import {
	makeJoinedSuffixedBasename,
	splitBySuffixDelimiter,
	tryMakeSeparatedSuffixedBasename,
} from "./core-suffix-utils";

const dropLibraryRootIfPresent = (pathParts: string[]): string[] => {
	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const root = splitPathToLibraryRoot.basename;
	return pathParts[0] === root ? pathParts.slice(1) : pathParts;
};

export const tryBuildCanonicalSeparatedSuffixedBasename = ({
	basename,
	pathParts,
	type,
}: Pick<SplitPathInsideLibrary, "basename" | "pathParts" | "type">): Result<
	CanonicalSeparatedSuffixedBasename,
	string
> => {
	return splitBySuffixDelimiter(basename).map((parts) => {
		const [coreName, ..._suffixFromName] = parts;

		const pathPartsSansRoot = dropLibraryRootIfPresent(pathParts);
		const suffixParts =
			type === SplitPathType.Folder
				? []
				: [...pathPartsSansRoot].reverse();

		return {
			separatedSuffixedBasename: { coreName: coreName, suffixParts },
		};
	});
};

export const tryParseCanonicalSplitPathInsideLibrary = (
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, string> => {
	// validate path parts as NodeNames (already required by your system)
	for (const p of sp.pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success)
			return err(r.error.issues[0]?.message ?? "Invalid path part");
	}

	return tryMakeSeparatedSuffixedBasename(sp).andThen((actualSep) => {
		return tryBuildCanonicalSeparatedSuffixedBasename(sp).andThen(
			(expected) => {
				const { coreName, suffixParts } = actualSep;
				const exp = expected.separatedSuffixedBasename;

				const same =
					coreName === exp.coreName &&
					suffixParts.length === exp.suffixParts.length &&
					suffixParts.every((v, i) => v === exp.suffixParts[i]);

				if (!same)
					return err("Basename does not match canonical format");

				// additionally enforce folder has no suffixParts (redundant but explicit)
				if (
					sp.type === SplitPathType.Folder &&
					suffixParts.length !== 0
				) {
					return err("Folder basename must not contain suffix parts");
				}

				return ok({ ...sp, separatedSuffixedBasename: actualSep });
			},
		);
	});
};

export const makeRegularSplitPathInsideLibrary = (
	sp: CanonicalSplitPathInsideLibrary,
): SplitPathInsideLibrary => {
	return {
		...sp,
		basename: makeJoinedSuffixedBasename(sp.separatedSuffixedBasename),
	};
};
