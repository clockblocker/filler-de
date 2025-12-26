import { getParsedUserSettings } from "../../../../global-state/global-state";
import type { NodeName, SplitSuffix } from "./node-name";

export function joinSeparatedCanonicalBasename({
	nodeName,
	splitSuffix,
}: {
	nodeName: NodeName;
	splitSuffix: SplitSuffix;
}) {
	const { suffixDelimiter } = getParsedUserSettings();

	return [nodeName, ...splitSuffix].join(suffixDelimiter);
}

export function separateJoinedCanonicalBasename(
	joinedCanonicalBasename: string,
) {
	const { suffixDelimiter } = getParsedUserSettings();

	const parts = joinedCanonicalBasename.split(suffixDelimiter);
	if (parts.length === 0) {
		return { nodeName: "", splitSuffix: [] };
	}

	const nodeName = parts[0] ?? "";
	const splitSuffix = parts.slice(1);

	return { nodeName, splitSuffix };
}
