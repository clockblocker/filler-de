import { CODEX_NODE_NAME } from "../../librarin-shared/types/literals";

/** @deprecated Use codexBasenameToChainCodec instead */
export function isBasenamePrefixedAsCodexDeprecated(basename: string): boolean {
	return basename.startsWith(CODEX_NODE_NAME);
}

/** @deprecated Use codexBasenameToChainCodec instead */
export function addCodexPrefixDeprecated(sectionName: string): string {
	return `${CODEX_NODE_NAME}${sectionName}`;
}
