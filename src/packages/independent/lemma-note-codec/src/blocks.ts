import type * as Dumrel from "dumrel/types";

/** The scope a Note Part covers: the Lemma, one Reading or one Surface. */
export type PartScope = "lemma" | "reading" | "surface";

/**
 * Blocks whose payload is one dumdict or dumrel field. Parse reads the
 * payload; the visible rendering beside it is derived and never parsed.
 */
export const SERIALIZED_BLOCK_KINDS = [
	"identity",
	"reading",
	"attestation",
	"translation",
	"attested_translation",
	"definition",
	"transcription",
	"relation",
	"pending_relation",
	"morphology",
	"valency",
	"participle_source",
	"plural",
	"conjugation_class",
	"preterite",
	"present_singular",
	"past_participle",
	"subjunctive_past",
	"locution_type",
	"saying_type",
	"formula_role",
	"notes",
	"surface",
] as const;

/** Blocks rendered from data and never parsed back. */
export const PROJECTION_BLOCK_KINDS = [
	"header",
	"inverse_relation",
	"inflection",
	"tags",
	"notes_title",
	"notes_placeholder",
] as const;

export type SerializedBlockKind = (typeof SERIALIZED_BLOCK_KINDS)[number];
export type ProjectionBlockKind = (typeof PROJECTION_BLOCK_KINDS)[number];
export type TypedBlockKind = SerializedBlockKind | ProjectionBlockKind;

/**
 * Each scope's typed Blocks in canonical order. The order is the dictionary
 * notes' layout (spec: Layout; render.ts `BLOCK_SECTIONS`): data-only Blocks
 * before the header, then Deine Kontexte, Note, Semantische Beziehungen,
 * Morpheme, Übersetzung, Flexion and Tags, with the Blocks the old notes had
 * no section for in between. A Reading part's freeform stands in its Note
 * section, after `notes_placeholder`; a Surface part's comes last.
 */
export const CANONICAL_BLOCK_ORDER = {
	lemma: ["identity"],
	reading: [
		"reading",
		"transcription",
		"plural",
		"conjugation_class",
		"preterite",
		"present_singular",
		"past_participle",
		"subjunctive_past",
		"header",
		"attestation",
		"notes_title",
		"notes",
		"notes_placeholder",
		"relation",
		"pending_relation",
		"inverse_relation",
		"morphology",
		"translation",
		"attested_translation",
		"definition",
		"valency",
		"participle_source",
		"locution_type",
		"saying_type",
		"formula_role",
		"inflection",
		"tags",
	],
	surface: ["surface", "attestation", "attested_translation", "notes"],
} as const satisfies Record<PartScope, readonly TypedBlockKind[]>;

/** The Reading Knowledge aspect each Knowledge Block serializes. */
export const KNOWLEDGE_BLOCKS = {
	conjugation_class: "conjugationClass",
	definition: "definition",
	formula_role: "formulaRole",
	locution_type: "locutionType",
	morphology: "morphologicalTree",
	participle_source: "participleSource",
	past_participle: "pastParticiple",
	plural: "plural",
	present_singular: "presentSingular",
	preterite: "preterite",
	relation: "semanticRelations",
	saying_type: "sayingType",
	subjunctive_past: "subjunctivePast",
	transcription: "transcription",
	translation: "translations",
	valency: "valency",
} as const satisfies Partial<
	Record<SerializedBlockKind, keyof Dumrel.ReadingKnowledge>
>;

/** Fails to compile when dumrel adds a Knowledge aspect no Block holds. */
type MissingAspects = Exclude<
	keyof Dumrel.ReadingKnowledge,
	(typeof KNOWLEDGE_BLOCKS)[keyof typeof KNOWLEDGE_BLOCKS]
>;
const everyAspectHasABlock: [MissingAspects] extends [never] ? true : never =
	true;
void everyAspectHasABlock;

const SERIALIZED: ReadonlySet<string> = new Set(SERIALIZED_BLOCK_KINDS);
const PROJECTION: ReadonlySet<string> = new Set(PROJECTION_BLOCK_KINDS);

export function isSerializedBlockKind(
	kind: string,
): kind is SerializedBlockKind {
	return SERIALIZED.has(kind);
}

export function isProjectionBlockKind(
	kind: string,
): kind is ProjectionBlockKind {
	return PROJECTION.has(kind);
}

export function allowedIn(scope: PartScope, kind: TypedBlockKind): boolean {
	const order: readonly TypedBlockKind[] = CANONICAL_BLOCK_ORDER[scope];
	return order.includes(kind);
}
