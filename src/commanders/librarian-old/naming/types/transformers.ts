import { getParsedUserSettings } from "../../../../global-state/global-state";
import type {
	NodeName,
	SplitSuffix,
} from "../../../librarin-shared/types/node-name";

export function joinSeparatedSuffixedBasename({
	nodeName,
	splitSuffix,
}: {
	nodeName: NodeName;
	splitSuffix: SplitSuffix;
}) {
	const { suffixDelimiter } = getParsedUserSettings();

	return [nodeName, ...splitSuffix].join(suffixDelimiter);
}

export function separateJoinedSuffixedBasename(joinedSuffixedBasename: string) {
	const { suffixDelimiter } = getParsedUserSettings();

	const parts = joinedSuffixedBasename.split(suffixDelimiter);
	if (parts.length === 0) {
		return { nodeName: "", splitSuffix: [] };
	}

	const nodeName = parts[0] ?? "";
	const splitSuffix = parts.slice(1);

	return { nodeName, splitSuffix };
}
