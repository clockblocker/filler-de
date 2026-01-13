import type { Codecs } from "../../../codecs";
import { CODEX_CORE_NAME } from "./literals";

/**
 * Check if a split path represents a codex file (basename starts with __).
 */
export function isCodexSplitPath(
	splitPath: { basename: string },
	codecs: Codecs,
): boolean {
	const result = codecs.suffix.parseSeparatedSuffix(splitPath.basename);
	return result.isOk() && result.value.coreName === CODEX_CORE_NAME;
}
