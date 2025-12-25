import { getParsedUserSettings } from "../../../global-state/global-state";
import type { ParsedBasename } from "../naming/parsed-basename";

/** @deprecated */
export function parseBasenameDeprecated(basename: string): ParsedBasename {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	const parts = basename.split(suffixDelimiter);
	const [coreName = "", ...splitSuffix] = parts;

	return { coreName, splitSuffix };
}
