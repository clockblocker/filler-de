export * from "./intent-key";
export * from "./merge-policy";
export type {
	ParsePropagationNoteOptions,
	PropagationNoteEntry,
	PropagationRawSection,
	PropagationSection,
	PropagationTypedSection,
	SerializePropagationNoteResult,
} from "./note-adapter";
export {
	parsePropagationNote,
	serializePropagationNote,
} from "./note-adapter";
export type {
	BuildTargetWriteActionsParams,
	FindCandidateTargetsParams,
	PropagationLibraryLookupPort,
	PropagationVaultPort,
	ReadManyMdFilesOutcome,
} from "./ports";
export type * from "./types";
