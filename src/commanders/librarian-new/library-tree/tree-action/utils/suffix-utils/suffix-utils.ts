import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../global-state/global-state";
import type { SplitPath } from "../../../../../../obsidian-vault-action-manager/types/split-path";
import { NamingError } from "../../../../types/schemas/errors";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../types/schemas/node-name";

export type SeparatedSuffixedBasename = {
	coreName: NodeName;
	suffixParts: NodeName[];
};

export const tryMakeSeparatedSuffixedBasename = ({
	basename,
}: SplitPath): Result<SeparatedSuffixedBasename, string> => {
	const parts = splitBySuffixDelimiter(basename);
	const [rawNodeName, ...rawSuffixParts] = parts;

	if (rawNodeName == null) {
		return err(NamingError.EmptyNodeName);
	}

	const nodeNameRes = NodeNameSchema.safeParse(rawNodeName);
	if (!nodeNameRes.success) {
		return err(nodeNameRes.error.issues[0]?.message ?? "Invalid NodeName");
	}

	const suffixParts: NodeName[] = [];
	for (const p of rawSuffixParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(r.error.issues[0]?.message ?? "Invalid suffix NodeName");
		}
		suffixParts.push(r.data);
	}

	return ok({
		coreName: nodeNameRes.data,
		suffixParts,
	});
};

export const splitBySuffixDelimiter = (basename: string): NodeName[] => {
	const { suffixDelimiter } = getParsedUserSettings();
	return basename.split(suffixDelimiter);
};

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
