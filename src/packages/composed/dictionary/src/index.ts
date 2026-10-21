export { CrossroadNoteMetadata } from "./crossroad";
export {
	type DictionaryCommitError,
	DictionaryPathOccupiedError,
	DictionaryRequestError,
	DictionaryRoundTripError,
	DictionaryScanError,
	DictionaryWriteError,
} from "./errors";
export {
	defineNestedNamespace,
	type MetadataFormat,
	noteMetadataHelper,
} from "./internal/note-metadata";
export {
	type CachedNote,
	createMemoryNoteCache,
	type DictionaryNoteCache,
} from "./note-cache";
export type { ReadingLocation, RelationEdge } from "./note-index";
export type { QuarantineReason } from "./notes";
export type { NoteProjections } from "./render";
export {
	type DictionaryDiagnostics,
	type DumdictVaultStore,
	type DumdictVaultStoreOptions,
	type HealingBlocked,
	type LemmaCandidate,
	makeDumdictVaultStore,
	type QuarantinedNote,
} from "./store";
export { type DictionaryVault, WORTER_SPLIT_PATH } from "./vault";
