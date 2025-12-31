import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../global-state/global-state";
import type { SplitPath } from "../../../../../../obsidian-vault-action-manager/types/split-path";
import { NamingError } from "../../../../types/schemas/errors";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../types/schemas/node-name";

export type SeparatedSuffixedBasename = {
	nodeName: NodeName;
	suffixParts: NodeName[];
};

export const tryMakeSeparatedSuffixedBasename = ({
	basename,
}: SplitPath): Result<SeparatedSuffixedBasename, string> => {
	const { suffixDelimiter } = getParsedUserSettings();

	const parts = basename.split(suffixDelimiter);
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
		nodeName: nodeNameRes.data,
		suffixParts,
	});
};

export const makeJoinedSuffixedBasename = ({
	nodeName,
	suffixParts,
}: SeparatedSuffixedBasename): SplitPath["basename"] => {
	const { suffixDelimiter } = getParsedUserSettings();
	return [nodeName, ...suffixParts].join(suffixDelimiter);
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
