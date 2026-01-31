export {
	makeCodexTransform,
	makeScrollBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "./backlink-transforms";
export {
	codexActionsToVaultActions,
	codexActionToVaultAction,
} from "./codex-actions-to-vault-actions";
export {
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	codexImpactToRecreations,
	extractInvalidCodexesFromBulk,
} from "./codex-impact-to-actions";
export { computeCodexSplitPath } from "./codex-split-path";
export {
	type CodexImpact,
	computeCodexImpact,
	type DescendantsStatusChange,
} from "./compute-codex-impact";
export { computeSectionStatus } from "./compute-section-status";
export {
	formatChildSectionLine,
	formatFileLine,
	formatParentBacklink,
	formatScrollLine,
} from "./format-codex-line";
export {
	generateChildrenList,
	generateCodexContent,
} from "./generate-codex-content";
export { PREFIX_OF_CODEX } from "./literals";
export { mergeCodexImpacts } from "./merge-codex-impacts";
export {
	type CodexClickTarget,
	parseCodexClickLineContent,
	parseCodexLinkTarget,
} from "./parse-codex-click";
export {
	chainToKey,
	collectImpactedSections,
	dedupeByKey,
	dedupeChains,
	expandToAncestors,
} from "./section-chain-utils";
export {
	collectDescendantScrolls,
	collectDescendantSectionChains,
	collectTreeData,
	type ScrollInfo,
	type TreeTraversalResult,
} from "./tree-collectors";
export type {
	CodexAction,
	EnsureCodexFileExistsAction,
	ProcessCodexAction,
	ProcessScrollBacklinkAction,
	UpsertCodexAction,
	WriteScrollStatusAction,
} from "./types/codex-action";
