export {
	type BulkVaultEventHandler,
	createVaultActionManager,
	type DispatchCaller,
	type DispatchOptions,
	type DispatchOrUndoOptions,
	describeVaultActionPath,
	dispatchOrUndoVia,
	isContentConflict,
	MAX_PRE_IMAGE_CHARS,
	type MdModifyEventHandler,
	type ProtectedPathModificationHandler,
	type VamActionFailureKind,
	VamActionFailureKindSchema,
	type VamActionOutcome,
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamActiveEditorFailureReasonSchema,
	VamContentConflictError,
	type VamDispatchEntry,
	VamDispatchError,
	VamDispatchFailure,
	type VamDispatchFailureReason,
	VamDispatchOverflowError,
	VamDispatchReport,
	type VamEffectError,
	type VamFileAccessError,
	type VamFileReadError,
	type VamFileWriteError,
	VamNoActiveEditorError,
	type VamNotUndoable,
	VamNotUndoableSchema,
	VamPlanningError,
	VamProtectedPathError,
	VamScanError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamTargetExistsError,
	type VamTouchedVault,
	type VamUndoBlock,
	VamUndoBlockSchema,
	type VamUndoPort,
	type VamUndoProbe,
	VamUndoProbeSchema,
	VamUndoReport,
	VamVaultIoError,
	type VaultActionManager,
	type VaultActionManagerFactoryResult,
	type VaultActionManagerOptions,
	type VaultActionManagerSubscription,
	type VaultSnapshotHandlers,
	type VaultSnapshotSubscription,
} from "./facade";
export type { ActiveEditorContext } from "./file-services/active-view/active-file-service";
export type { SelectionInfo } from "./file-services/active-view/selection-service";
export { vaultActionTargetPath } from "./helpers/action-helpers";
export type {
	BulkVaultEvent,
	ObservedRootVaultEvent,
} from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
export type {
	BulkMdModifyEvent,
	MdFileModification,
} from "./impl/event-processing/md-modify-event";
export type {
	ProtectedModificationWriter,
	ProtectedPathModification,
	ProtectedPathModificationsEvent,
} from "./impl/event-processing/protected-modifications";
export { vaultContentHash } from "./internal/content-hash";
export { type SplitPathCodec, splitPathCodec } from "./split-path-codec";
export {
	EXTERNAL_ORIGIN,
	type LinkUpdateBasis,
	type VamCaller,
	type VamOperation,
	type VamOperationId,
	type VamSubscribeOptions,
	type VaultEventOrigin,
} from "./types/event-origin";
export type { VaultFileStat } from "./types/file-stat";
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
export {
	type VaultFileSystem,
	VaultPath,
	type VaultPathIdentity,
} from "./vault-path";
export type {
	VaultCursor,
	VaultScanCounts,
	VaultScanPath,
	VaultScanPathWithStat,
	VaultScanReadableMdPath,
	VaultScanResult,
	VaultSnapshot,
} from "./vault-scan";
