import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SeparatedSuffixedBasename } from "../naming/schemas/node-name";

/** @deprecated */
export function parseBasenameDeprecated(
	basename: string,
): SeparatedSuffixedBasename {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	const parts = basename.split(suffixDelimiter);
	const [nodeName = "", ...splitSuffix] = parts;

	return { nodeName, splitSuffix };
}
