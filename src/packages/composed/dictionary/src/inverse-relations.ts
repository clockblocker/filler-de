import {
	type LemmaNoteDocument,
	type Projections,
	parseDocument,
	type SemanticRelationProjection,
} from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import type { ReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import {
	type directSemanticRelationValues,
	projectSemanticRelations,
} from "dumrel";
import { lemmaKeyOf, readingKeyOf } from "./keys";
import type { NoteIndex, RelationEdge } from "./note-index";

/** A Lemma note's projected relations, by the `readingKeyOf` of its Reading. */
export type InverseRelations = ReadonlyMap<
	string,
	readonly SemanticRelationProjection[]
>;

/**
 * The relation a direct claim's target holds back to its source, as
 * dumrel's projection algebra has it. Typed over dumrel's direct relations,
 * so a new one fails to compile until it is given an inverse here.
 */
const INVERSE: Readonly<
	Record<(typeof directSemanticRelationValues)[number], string>
> = {
	antonym: "antonym",
	endonym: "exonym",
	holonym: "meronym",
	hypernym: "hyponym",
	nearAntonym: "nearAntonym",
	nearSynonym: "nearSynonym",
	synonym: "synonym",
};

const inverseOf = (relation: string): string | undefined =>
	INVERSE[relation as keyof typeof INVERSE];

type Inventory = ReadonlyMap<string, ReadingEntry<"de">>;

/**
 * A Reading's direct claims cut down to targets inside the inventory, so
 * the projection depends on nothing but the inventory, and never fails on
 * an exact target it was not given. A Reading keeps its target mode.
 */
function claimsWithin(
	entry: ReadingEntry<"de">,
	inventory: Inventory,
	lemmaKeys: ReadonlySet<string>,
) {
	const relations = entry.knowledge?.semanticRelations as
		| Readonly<Record<string, unknown>>
		| undefined;
	if (!relations) return {};
	const byReading = relations.targetKind === "reading";
	const kept: Record<string, unknown> = {};
	for (const [relation, targets] of Object.entries(relations)) {
		if (relation === "targetKind" || !Array.isArray(targets)) continue;
		const within = targets.filter((target) =>
			byReading
				? inventory.has(readingKeyOf(target as Dumling.Reading<"de">))
				: lemmaKeys.has(lemmaKeyOf(target as Dumling.Lemma<"de">)),
		);
		if (within.length > 0) kept[relation] = within;
	}
	if (byReading)
		return { semanticRelations: { ...kept, targetKind: "reading" } };
	return Object.keys(kept).length === 0 ? {} : { semanticRelations: kept };
}

/**
 * Whether a claim reaches this Reading: an exact claim on it, or a Lemma
 * claim on a Lemma whose only Reading it is (ADR 0011).
 */
const reachesReading = (
	edge: RelationEdge,
	readingKey: string,
	readingCount: number,
): boolean =>
	edge.target.kind === "lemma"
		? readingCount === 1
		: readingKeyOf(edge.target.reading) === readingKey;

/**
 * The claims on this Reading an inferred edge mirrors, as edges to their
 * source Readings. dumrel names a Lemma-mode inverse by its Lemma; the
 * link should land on the source Reading's Block (ADR 0012), so each
 * Reading of that Lemma that makes the mirrored claim stands in for it.
 * An edge no claim on this note explains, such as a substitution through
 * a synonym, is not an inverse and yields nothing.
 */
function mirroredClaims(
	projection: SemanticRelationProjection,
	readingKey: string,
	readingCount: number,
	edges: readonly RelationEdge[],
): SemanticRelationProjection[] {
	const { target } = projection;
	const matches = (source: Dumling.Reading<"de">) =>
		target.unitKind === "Lemma"
			? lemmaKeyOf(source.lemma) ===
				lemmaKeyOf(target as Dumling.Lemma<"de">)
			: readingKeyOf(source) ===
				readingKeyOf(target as Dumling.Reading<"de">);
	const sources = new Map<string, Dumling.Reading<"de">>();
	for (const edge of edges)
		if (
			inverseOf(edge.relation) === projection.relation &&
			reachesReading(edge, readingKey, readingCount) &&
			matches(edge.source)
		)
			sources.set(readingKeyOf(edge.source), edge.source);
	return [...sources.values()].map((source) => ({
		...projection,
		target: source as SemanticRelationProjection["target"],
	}));
}

/**
 * The inverse Semantic Relations a Lemma note shows: for each claim
 * another note's Reading makes on this Lemma or one of its Readings, the
 * relation this Reading holds back, linked to the claiming Reading. dumrel's
 * `projectSemanticRelations` decides which inverses hold (batteries ADR
 * 0011, 0012): a Lemma target on a homonymous Lemma has none, and a direct
 * claim of this note's own wins over an inferred one. The inventory is the
 * note's own Readings and the claiming Readings, with dictionary-wide
 * Reading counts, so the result changes only when this note or a note with
 * a claim on it changes. Undefined when dumrel rejects the inventory.
 */
export function inverseRelationsOf(
	view: NoteIndex,
	lemmaKey: string,
): InverseRelations | undefined {
	const data = view.lemmaData(lemmaKey);
	const edges = view
		.edgesTo(lemmaKey)
		.filter((edge) => lemmaKeyOf(edge.source.lemma) !== lemmaKey);
	if (!data || edges.length === 0) return new Map();

	const inventory = new Map<string, ReadingEntry<"de">>();
	for (const entry of data.readingEntries)
		inventory.set(readingKeyOf(entry.reading), entry);
	for (const { source } of edges) {
		const key = readingKeyOf(source);
		const entry = inventory.has(key) ? undefined : view.reading(key);
		if (entry) inventory.set(key, entry);
	}
	const lemmaKeys = new Set(
		[...inventory.values()].map(({ reading }) => lemmaKeyOf(reading.lemma)),
	);
	const projected = projectSemanticRelations(
		[...inventory.values()].map((entry) => ({
			knowledge: claimsWithin(entry, inventory, lemmaKeys),
			reading: entry.reading,
		})) as Parameters<typeof projectSemanticRelations>[0],
		{
			readingCounts: [...lemmaKeys].flatMap((key) => {
				const held = view.lemmaData(key);
				return held
					? [
							{
								lemma: held.lemmaRecord.lemma,
								readingCount: held.readingEntries.length,
							},
						]
					: [];
			}),
		},
	);
	if (!projected.success) return undefined;

	const own = new Set(
		data.readingEntries.map(({ reading }) => readingKeyOf(reading)),
	);
	const byReading = new Map<string, SemanticRelationProjection[]>();
	const seen = new Set<string>();
	for (const projection of projected.value) {
		if (projection.provenance !== "inferred") continue;
		const readingKey = readingKeyOf(
			projection.source as Dumling.Reading<"de">,
		);
		if (!own.has(readingKey)) continue;
		for (const edge of mirroredClaims(
			projection,
			readingKey,
			data.readingEntries.length,
			edges,
		)) {
			const key = canonicalJson([
				readingKey,
				edge.relation,
				readingKeyOf(edge.target as Dumling.Reading<"de">),
			]);
			if (seen.has(key)) continue;
			seen.add(key);
			byReading.set(readingKey, [
				...(byReading.get(readingKey) ?? []),
				edge,
			]);
		}
	}
	return byReading;
}

/**
 * The inverse relations of every note, read against one index version and
 * computed at most once per Lemma. `failed` collects the Lemmas dumrel
 * rejected; their notes render no `inverse_relation` Block.
 */
export function inverseRelationsReader(view: NoteIndex) {
	const memo = new Map<string, InverseRelations | undefined>();
	const failed = new Set<string>();
	const read = (lemmaKey: string): InverseRelations | undefined => {
		if (memo.has(lemmaKey)) return memo.get(lemmaKey);
		const computed = inverseRelationsOf(view, lemmaKey);
		if (computed === undefined) failed.add(lemmaKey);
		memo.set(lemmaKey, computed);
		return computed;
	};
	return { failed, read };
}

/** The codec's projections, with the `inverseRelations` hook read from `read`. */
export function withInverseRelations(
	projections: Omit<Projections<"de">, "inverseRelations"> | undefined,
	read: (lemmaKey: string) => InverseRelations | undefined,
): Projections<"de"> {
	return {
		...projections,
		inverseRelations: ({ entry, lemma }) =>
			read(lemmaKeyOf(lemma))?.get(readingKeyOf(entry.reading)),
	};
}

/** Each part's `inverse_relation` Blocks, as their raw lines, by Block ID. */
function inverseBlocksOf(document: LemmaNoteDocument): string {
	// Parts compare by Block ID, so reordering them by hand is no change.
	const byPart = new Map<string, string[]>();
	for (const part of document.parts) {
		const id = part.blockId ?? "";
		byPart.set(id, [
			...(byPart.get(id) ?? []),
			...part.blocks
				.filter(
					(block) =>
						block.type === "projection" &&
						block.kind === "inverse_relation",
				)
				.map((block) => block.raw.trimEnd()),
		]);
	}
	return canonicalJson(Object.fromEntries(byPart));
}

/**
 * Whether a note's file shows other inverse relations than `rendered`, the
 * content the store would write for it now. Only the `inverse_relation`
 * Blocks are compared, so a note whose other Blocks or freeform text sit
 * out of canonical order is not rewritten for that alone.
 */
export const showsOtherInverseRelations = (
	current: string,
	rendered: string,
): boolean =>
	inverseBlocksOf(parseDocument(current)) !==
	inverseBlocksOf(parseDocument(rendered));
