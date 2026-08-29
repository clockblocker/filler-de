export type { SelectionInfo } from "./file-services/active-view/selection-service";
export * from "./helpers/pathfinder";
export {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
export {
	createVaultActionManager,
	type VaultActionManager,
	type VaultActionManagerFactoryResult,
} from "./legacy-neverthrow-facade";
export type { DispatchError, DispatchResult } from "./types/dispatch";
export * from "./types/literals";
export {
	classifyReadContentError,
	isReadContentFileNotFound,
	type ReadContentError,
	ReadContentErrorKind,
	readContentErrorToReason,
} from "./types/read-content-error";
export * from "./types/split-path";
export * from "./types/vault-action";
export { type VaultAction, VaultActionKind } from "./types/vault-action";
export * from "./types/vault-event";
export { type VaultEvent, VaultEventKind } from "./types/vault-event";
