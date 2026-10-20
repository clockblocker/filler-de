import type {
	Projections,
	SemanticRelationProjection,
} from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import type { ReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import { projectSemanticRelations } from "dumrel";
import { lemmaKeyOf, readingKeyOf } from "./keys";
import type { NoteIndex, RelationEdge } from "./note-index";

/** A Lemma note's projected relations, by the `readingKeyOf` of its Reading. */
export type InverseRelations = ReadonlyMap<
	string,
	readonly SemanticRelationProjection[]
>;

/** The relation a direct claim's target holds back to its source (dumrel's algebra). */
const INVERSE: Readonly<Record<string, string>> = {
	antonym: "antonym",
	endonym: "exonym",
	holonym: "meronym",
	hypernym: "hyponym",
	nearAntonym: "nearAntonym",
	nearSynonym: "nearSynonym",
	synonym: "synonym",
};

type Inventory = ReadonlyMap<string, ReadingEntry<"de">>;

/**
 * A Reading's direct claims cut down to targets inside the inventory, so
 * the projection depends on nothing but the inventory, and never fails on
 * an exact target it was not given.
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
	if (Object.keys(kept).length === 0) return {};
	return {
		semanticRelations: byReading
			? { ...kept, targetKind: "reading" }
			: kept,
	};
}

const reachesReading = (edge: RelationEdge, readingKey: string): boolean =>
	edge.target.kind === "lemma" ||
	readingKeyOf(edge.target.reading) === readingKey;

/**
 * Points a projected edge at the Reading whose claim it mirrors. dumrel
 * names a Lemma-mode inverse by its Lemma; the link should land on the
 * source Reading's Block (ADR 0012), so each Reading of that Lemma that
 * makes the mirrored claim stands in for it. An edge no claim explains
 * keeps its Lemma.
 */
function toSourceReadings(
	projection: SemanticRelationProjection,
	readingKey: string,
	edges: readonly RelationEdge[],
): SemanticRelationProjection[] {
	const { target } = projection;
	if (target.unitKind !== "Lemma") return [projection];
	const targetKey = lemmaKeyOf(target as Dumling.Lemma<"de">);
	const sources = new Map<string, Dumling.Reading<"de">>();
	for (const edge of edges)
		if (
			lemmaKeyOf(edge.source.lemma) === targetKey &&
			INVERSE[edge.relation] === projection.relation &&
			reachesReading(edge, readingKey)
		)
			sources.set(readingKeyOf(edge.source), edge.source);
	if (sources.size === 0) return [projection];
	return [...sources.values()].map((source) => ({
		...projection,
		target: source as SemanticRelationProjection["target"],
	}));
}

/**
 * The inverse and inferred Semantic Relations a Lemma note shows, computed
 * with dumrel's `projectSemanticRelations` over the claims that target it
 * (batteries ADR 0011, 0012). The inventory is the note's own Readings and
 * the source Readings of those claims, with dictionary-wide Reading
 * counts, so the result changes only when this note or a note with a
 * claim on it changes. Direct claims are left out: the `relation` Block
 * already shows them.
 */
export function inverseRelationsOf(
	view: NoteIndex,
	lemmaKey: string,
): InverseRelations {
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
	if (!projected.success) return new Map();

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
		for (const edge of toSourceReadings(projection, readingKey, edges)) {
			const key = canonicalJson([readingKey, edge.relation, edge.target]);
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

/** Whether two notes' projected relations render the same Blocks. */
export const sameInverseRelations = (
	left: InverseRelations,
	right: InverseRelations,
): boolean => {
	const sorted = (relations: InverseRelations) =>
		[...relations].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return canonicalJson(sorted(left)) === canonicalJson(sorted(right));
};

/**
 * The inverse relations of every note, read against one index version and
 * computed at most once per Lemma.
 */
export function inverseRelationsReader(view: NoteIndex) {
	const memo = new Map<string, InverseRelations>();
	return (lemmaKey: string): InverseRelations => {
		const cached = memo.get(lemmaKey);
		if (cached) return cached;
		const computed = inverseRelationsOf(view, lemmaKey);
		memo.set(lemmaKey, computed);
		return computed;
	};
}

/** The codec's projections, with the `inverseRelations` hook read from `view`. */
export function withInverseRelations(
	projections: Omit<Projections<"de">, "inverseRelations"> | undefined,
	read: (lemmaKey: string) => InverseRelations,
): Projections<"de"> {
	return {
		...projections,
		inverseRelations: ({ entry, lemma }) =>
			read(lemmaKeyOf(lemma)).get(readingKeyOf(entry.reading)),
	};
}
