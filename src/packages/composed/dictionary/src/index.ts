export { CrossroadNoteMetadata } from "./crossroad";
export {
	type DictionaryCommitError,
	DictionaryPathOccupiedError,
	DictionaryRequestError,
	DictionaryRoundTripError,
	DictionaryScanError,
	DictionaryTransactionConflict,
	DictionaryWriteError,
} from "./errors";
export { freeformPlacementProblem } from "./freeform";
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
	makeDumdictVaultStore,
	type QuarantinedNote,
	type TablesRerendered,
} from "./store";
export { Transaction, type TransactOptions } from "./transaction";
export {
	DICTIONARY_CALLER,
	type DictionaryVault,
	WORTER_SPLIT_PATH,
} from "./vault";
export type {
	DictionaryView,
	LemmaCandidate,
	StoredLemmaNote,
} from "./view";
