import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../global-state/global-state";
import type { SplitPath } from "../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NonEmptyArray } from "../../../../../../../../types/helpers";
import { nonEmptyArrayResult } from "../../../../../../../../types/utils";
import { NamingError } from "../../../../../../types/schemas/errors";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../types/schemas/node-name";

export type SeparatedSuffixedBasename = {
	coreName: NodeName;
	suffixParts: NodeName[];
};

export const tryParseAsSeparatedSuffixedBasename = ({
	basename,
}: Pick<SplitPath, "basename">): Result<SeparatedSuffixedBasename, string> => {
	return splitBySuffixDelimiter(basename).andThen((parts) => {
		const [coreName, ...suffixParts] = parts;
		return ok({ coreName, suffixParts });
	});
};

export const splitBySuffixDelimiter = (
	basename: string,
): Result<NonEmptyArray<NodeName>, string> => {
	const { suffixDelimiter } = getParsedUserSettings();
	const raw = basename.split(suffixDelimiter);
	const out: NodeName[] = [];

	for (const seg of raw) {
		const r = NodeNameSchema.safeParse(seg);
		if (!r.success)
			return err(r.error.issues[0]?.message ?? NamingError.EmptyNodeName);
		out.push(r.data);
	}

	return nonEmptyArrayResult(out);
};

// function foo<T>(items: T[]): [T, ...T[]] {
// 	const first = items[0]!
// 	return [first, ...items]  // always at least 1
//   }

export const makeJoinedSuffixedBasename = ({
	coreName,
	suffixParts,
}: SeparatedSuffixedBasename): SplitPath["basename"] => {
	const { suffixDelimiter } = getParsedUserSettings();
	return [coreName, ...suffixParts].join(suffixDelimiter);
};

export const makePathPartsFromSuffixParts = ({
	suffixParts,
}: SeparatedSuffixedBasename): SplitPath["pathParts"] => {
	return [...suffixParts].reverse();
};

export const makeSuffixPartsFromPathParts = ({
	pathParts,
}: SplitPath): SeparatedSuffixedBasename["suffixParts"] => {
	return [...pathParts].reverse();
};

/**
 * Converts pathParts (WITH Library root) to suffixParts (WITHOUT root, reversed).
 * Use when pathParts includes Library root as first element.
 */
export const makeSuffixPartsFromPathPartsWithRoot = (
	pathParts: string[],
): SeparatedSuffixedBasename["suffixParts"] => {
	// Drop Library root (first element), then reverse
	return pathParts
		.slice(1)
		.reverse() as SeparatedSuffixedBasename["suffixParts"];
};
