export {
	assignBlockIds,
	BLOCK_ID_HASH_LENGTH,
	type BlockIdTarget,
	blockIdsOf,
	type NoteBlockIds,
	READING_BLOCK_ID_PREFIX,
	readingBlockId,
	SURFACE_BLOCK_ID_PREFIX,
} from "./block-ids";
export {
	CANONICAL_BLOCK_ORDER,
	type PartScope,
	PROJECTION_BLOCK_KINDS,
	type ProjectionBlockKind,
	SERIALIZED_BLOCK_KINDS,
	type SerializedBlockKind,
	type TypedBlockKind,
} from "./blocks";
export { documentToData, type LemmaNoteDataResult } from "./data";
export {
	EMPTY_DOCUMENT,
	type LemmaNoteDocument,
	type NoteBlock,
	type NotePart,
	parseDocument,
	serializeDocument,
} from "./document";
export { sha256Hex } from "./hash";
export type {
	CodecIssue,
	CodecIssueTag,
	IssueLocation,
	RecordName,
} from "./issues";
export { type LemmaNoteParse, parse } from "./parse";
export {
	BASENAME_KEPT,
	BASENAME_LIMIT,
	canonicalFormBasename,
	type DecodedBasename,
	decodeBasename,
} from "./path/basename";
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
	type LegacyNotePathParse,
	legacyLemmaNotePath,
	type ParsedLegacyLemmaNotePath,
	type ParsedLegacyNotePath,
	type ParsedShadowNotePath,
	parseLegacyNotePath,
	SHADOW_FOLDER,
	shadowNotePath,
} from "./path/legacy-note-path";
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
	DEFAULT_LINKS,
	type LinkRenderer,
	type Projections,
	type ReadingProjectionContext,
	type SemanticRelationProjection,
} from "./render";
export {
	LemmaNoteSerializeError,
	type SerializeOptions,
	serialize,
} from "./serialize";
export type {
	CodecOptions,
	LemmaNoteData,
	PartialLemmaNoteData,
	SurfaceId,
} from "./types";
