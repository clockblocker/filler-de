export {
	type BulkVaultEventHandler,
	createVaultActionManager,
	VamDispatchError,
	type VamEffectError,
	VamPlanningError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamVaultIoError,
	type VaultActionManager,
	type VaultActionManagerFactoryResult,
	type VaultActionManagerReadableMdPath,
	type VaultActionManagerReadablePath,
	type VaultActionManagerSubscription,
} from "./facade";
export type { SelectionInfo } from "./file-services/active-view/selection-service";
export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
export { type SplitPathCodec, splitPathCodec } from "./split-path-codec";
export * from "./types/literals";
export {
	classifyReadContentError,
	isReadContentFileNotFound,
	type ReadContentError,
	ReadContentErrorKind,
	readContentErrorToReason,
} from "./types/read-content-error";
export {
	type AnySplitPath,
	type CommonSplitPath,
	CoreSplitPathSchema,
	type PathParts,
	PathPartsSchema,
	type SplitPath,
	type SplitPathFromTo,
	SplitPathKind,
	SplitPathSchema,
	type SplitPathToAnyFile,
	type SplitPathToFile,
	SplitPathToFileSchema,
	type SplitPathToFolder,
	SplitPathToFolderSchema,
	type SplitPathToMdFile,
	SplitPathToMdFileSchema,
} from "./types/split-path";
export * from "./types/vault-action";
export { type VaultAction, VaultActionKind } from "./types/vault-action";
export * from "./types/vault-event";
export { type VaultEvent, VaultEventKind } from "./types/vault-event";
