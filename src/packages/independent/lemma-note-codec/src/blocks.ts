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
] as const;

export type SerializedBlockKind = (typeof SERIALIZED_BLOCK_KINDS)[number];
export type ProjectionBlockKind = (typeof PROJECTION_BLOCK_KINDS)[number];
export type TypedBlockKind = SerializedBlockKind | ProjectionBlockKind;

/** Each scope's typed Blocks in canonical order; freeform comes last. */
export const CANONICAL_BLOCK_ORDER = {
	lemma: ["identity"],
	reading: [
		"header",
		"reading",
		"attestation",
		"translation",
		"attested_translation",
		"definition",
		"transcription",
		"relation",
		"pending_relation",
		"inverse_relation",
		"morphology",
		"valency",
		"participle_source",
		"plural",
		"conjugation_class",
		"locution_type",
		"saying_type",
		"formula_role",
		"inflection",
		"tags",
		"notes",
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
	plural: "plural",
	relation: "semanticRelations",
	saying_type: "sayingType",
	transcription: "transcription",
	translation: "translations",
	valency: "valency",
} as const satisfies Partial<
	Record<SerializedBlockKind, keyof Dumrel.ReadingKnowledge>
>;

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
