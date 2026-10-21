/**
 * `@textfresser/lemma-note-codec`: dictionary notes as Markdown (spec:
 * `src/documentaion/specs/linguistic-note-codec-spec.md`).
 *
 * - **Lemma notes** and **Reading notes**: `parse*Note` reads a note's
 *   records from its metadata and splits its body at the rendering
 *   boundary; `serialize*Note` writes its body and the metadata to store;
 *   `render*Note` writes the body alone.
 * - **Metadata**: the namespace specs the plugin defines its note-metadata
 *   namespaces from, and their schemas.
 * - **Paths**: where each note lives (ADR-0015).
 *
 * It depends only on the batteries: no vault I/O, no lookup, no facility.
 */
export {
	assignBlockIds,
	BLOCK_ID_HASH_LENGTH,
	SINGLE_TABLE_BLOCK_ID,
	SURFACE_BLOCK_ID_PREFIX,
	surfaceBlockIds,
	TABLE_BLOCK_ID_PREFIX,
	tableBlockIds,
} from "./block-ids";
export {
	type BodySegment,
	BodyWriter,
	freeformOf,
	linesOf,
	type RenderedBlock,
	type RenderingSeal,
	readBody,
	renderingLines,
	SEAL_HASH_LENGTH,
	sealOf,
} from "./boundary";
export { sha256Hex } from "./hash";
export {
	type InflectionHook,
	type InflectionInput,
	inflectionFromPack,
	type LemmaTable,
	type LemmaTables,
	lemmaTables,
	type RenderedInflection,
	type RenderedSurfaceAxes,
	type RenderedTable,
	tableOfReading,
} from "./inflection";
export type {
	CodecIssue,
	CodecIssueTag,
	IssueLocation,
	RecordName,
} from "./issues";
export {
	type LemmaNoteBlockIds,
	type LemmaNoteDataResult,
	type LemmaNoteDocument,
	type LemmaNoteParse,
	type NoteSource,
	parseLemmaNote,
	renderLemmaNote,
	serializeLemmaNote,
} from "./lemma-note";
export {
	DEFAULT_PATHS,
	defaultResolve,
	type LinkNamed,
	type LinkRenderer,
	type LinkResolver,
	type LinkRole,
	type LinkSubject,
	linkRenderer,
	type NotePaths,
	shadowOf,
	wikilink,
} from "./links";
export {
	type DataResult,
	LEMMA_NOTE_METADATA,
	type LemmaNoteMetadata,
	LemmaNoteMetadataSchema,
	lemmaNoteDataOf,
	lemmaNoteMetadataOf,
	type NoteMetadataSpec,
	READING_NOTE_METADATA,
	type ReadingNoteMetadata,
	ReadingNoteMetadataSchema,
	readingNoteDataOf,
	readingNoteMetadataOf,
} from "./metadata";
export {
	type LemmaNotePaths,
	lemmaNoteOwner,
	notePathsOf,
	readingNoteOwner,
} from "./note-paths";
export {
	caseFold,
	findPathCollisions,
	type PathClaim,
	type PathCollision,
	pathCollisionKey,
} from "./path/collision";
export {
	type InvalidNotePath,
	type NotePath,
	type PathLemma,
	WORTER_FOLDER,
} from "./path/common";
export {
	FILE_NAME_MAX_BYTES,
	NAME_SEGMENT_FALLBACK,
	NAME_SEGMENT_MAX_BYTES,
	RESERVED_NAME_PREFIX,
	toNameSegment,
} from "./path/name-segment";
export {
	crossroadNotePath,
	FOREIGN_READING_MARKER,
	lemmaNotePath,
	type NotePathParse,
	type ParsedCrossroadNotePath,
	type ParsedLemmaNotePath,
	type ParsedNotePath,
	type ParsedReadingNotePath,
	type ParsedStrayNotePath,
	parseNotePath,
	readingNotePath,
} from "./path/note-path";
export { type ShardFolders, shardFolders } from "./path/shards";
export {
	GERMAN_SLOT_TABLE,
	germanSlotsOf,
	type Slot,
	type SlotEncoding,
} from "./path/slot-table-de";
export {
	NOTE_PLACEHOLDER,
	parseReadingNote,
	type ReadingNoteDocument,
	type ReadingNoteParse,
	renderReadingNote,
	serializeReadingNote,
} from "./reading-note";
export {
	DEFAULT_TITLES,
	type SectionKind,
	type SemanticRelationProjection,
} from "./render/common";
export {
	NoteSerializeError,
	type PreviousDocument,
	type ReadingNoteContext,
	type RenderOptions,
	type SerializedNote,
	type SerializeOptions,
} from "./render/options";
export {
	drawTable,
	type TableDrawContext,
	type TableDrawer,
} from "./render/table";
export type {
	CodecOptions,
	LemmaNoteData,
	LemmaRecords,
	ReadingNoteData,
	SurfaceId,
} from "./types";
