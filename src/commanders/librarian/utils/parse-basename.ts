import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SeparatedCanonicalBasename } from "../naming/schemas/node-name";

/** @deprecated */
export function parseBasenameDeprecated(
	basename: string,
): SeparatedCanonicalBasename {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	const parts = basename.split(suffixDelimiter);
	const [nodeName = "", ...splitSuffix] = parts;

	return { nodeName, splitSuffix };
}
