import { CODEX_CORE_NAME } from "../types/literals";

/** @deprecated Use codexBasenameToChainCodec instead */
export function isBasenamePrefixedAsCodexDeprecated(basename: string): boolean {
	return basename.startsWith(CODEX_CORE_NAME);
}

/** @deprecated Use codexBasenameToChainCodec instead */
export function addCodexPrefixDeprecated(sectionName: string): string {
	return `${CODEX_CORE_NAME}${sectionName}`;
}
