/**
 * What `knowledge.produce` is asked for one occurrence (#64): the Knowledge
 * the Reading's route applies, less what its stored entry already covers.
 *
 * tf-demo keeps durable evidence of answered aspects; the plugin's only
 * evidence is the Lemma note, so an aspect that may rightly come back
 * empty (a Valency Frame, a Locution Type, a relation kind with no target)
 * would be asked again on every encounter. Structural aspects and
 * Semantic Relations are therefore asked only by the occurrence that
 * created the Reading (`New`); a later one (`TopUp`) asks only for the
 * base text it still lacks, as tf-demo's incremental publication does.
 */
import { routeOf } from "dumling";
import type * as Dumling from "dumling/types";
import {
	directSemanticRelationValues,
	paradigmDimensions,
	selectKnowledge,
} from "dumrel";
import type * as Dumrel from "dumrel/types";
import { Predicate } from "effect";
import type { KnowledgeOrigin } from "./knowledge-types";

/**
 * Whether the plugin publishes the Semantic Relations dumgen generates.
 * tf-demo drops them all until a reviewed verdict qualifies a relation
 * kind; the plugin has always written relations, so it keeps publishing
 * them. A Pending one is stored in its source note only, and its link
 * points at the target's Crossroad path.
 * Flip this to stop asking for and publishing generated relations.
 */
export const PUBLISH_GENERATED_RELATIONS = true;

export type TranslationLanguage = Dumrel.TranslationLanguage;

type StoredKnowledge = {
	/** The stored entry's Knowledge, if the Reading is stored. */
	readonly knowledge?: Dumrel.ReadingKnowledge<Dumling.Reading<"de">>;
	/** Relation kinds a Pending Semantic Relation of the Reading already claims. */
	readonly pendingRelationKinds: readonly string[];
};

/** Aspects a `TopUp` occurrence may still ask for. */
const BASE_TEXT_ASPECTS = new Set([
	"transcription",
	"definition",
	"translations",
]);

/**
 * Never asked: a Reading's Breakdown and its Source (texteater ADR 0050)
 * come with the Breakdown adoption, which asks and renders them.
 */
const NEVER_ASKED = new Set(["breakdown", "source"]);

function covered(
	stored: StoredKnowledge,
	aspect: string,
	leaf?: string,
): boolean {
	const knowledge: Readonly<Record<string, unknown>> = stored.knowledge ?? {};
	const value = knowledge[aspect];
	if (leaf === undefined) return value !== undefined;
	if (aspect === "translations") {
		const leaves = (Predicate.isObject(value) ? value : {}) as Readonly<
			Record<string, unknown>
		>;
		const forLanguage = leaves[leaf];
		return Array.isArray(forLanguage) && forLanguage.length > 0;
	}
	if (aspect === "semanticRelations") {
		const relations = (Predicate.isObject(value) ? value : {}) as Readonly<
			Record<string, unknown>
		>;
		return (
			Array.isArray(relations[leaf]) ||
			stored.pendingRelationKinds.includes(leaf)
		);
	}
	return value !== undefined;
}

/**
 * The request mask for one occurrence of `reading`, or an empty mask when
 * the stored entry covers everything this occurrence may ask.
 */
export function knowledgeRequestFor(input: {
	readonly reading: Dumling.Reading<"de">;
	readonly origin: KnowledgeOrigin;
	readonly translationLanguages: readonly TranslationLanguage[];
	readonly stored: StoredKnowledge;
	readonly publishRelations?: boolean;
}): Dumrel.KnowledgeRequestMask {
	const publishRelations =
		input.publishRelations ?? PUBLISH_GENERATED_RELATIONS;
	const selected = selectKnowledge({
		route: routeOf(input.reading.lemma),
		settings: {
			translations: {
				en: input.translationLanguages.includes("en"),
				ru: input.translationLanguages.includes("ru"),
			},
		},
	});
	if (!selected.success) return {};
	const request: Record<string, null | Record<string, null>> = {};
	for (const [aspect, selection] of Object.entries(selected.value)) {
		if (selection === undefined || NEVER_ASKED.has(aspect)) continue;
		if (input.origin === "TopUp" && !BASE_TEXT_ASPECTS.has(aspect))
			continue;
		if (aspect === "semanticRelations" && !publishRelations) continue;
		if (selection === null) {
			if (!covered(input.stored, aspect)) request[aspect] = null;
			continue;
		}
		const leaves: Record<string, null> = {};
		for (const leaf of Object.keys(selection)) {
			if (
				aspect === "semanticRelations" &&
				!(directSemanticRelationValues as readonly string[]).includes(
					leaf,
				)
			)
				continue;
			if (!covered(input.stored, aspect, leaf)) leaves[leaf] = null;
		}
		if (Object.keys(leaves).length > 0) request[aspect] = leaves;
	}
	return request as Dumrel.KnowledgeRequestMask;
}

/**
 * Aspects a later occurrence asks again when they failed or never came.
 * The principal parts that a New occurrence alone asked moved from Reading
 * Knowledge into the Lemma Paradigm (texteater#1226); see
 * {@link paradigmRequestFor}.
 */
export const RETRIED_ASPECTS: ReadonlySet<string> = BASE_TEXT_ASPECTS;

/**
 * Whether Classify asks `knowledge.produce` for the Lemma Paradigm
 * (texteater#1230) and publishes its `paradigmChanges` with the rest of
 * the Knowledge.
 */
export const PRODUCE_LEMMA_PARADIGM = true;

/** `knowledge.produce`'s `paradigm` input (texteater#1230). */
export type ParadigmRequest = {
	readonly dimensions: readonly Dumrel.DimensionId[];
	readonly stored?: Dumrel.LemmaParadigm;
	readonly readings?: readonly Dumling.Reading<"de">[];
};

/**
 * The Lemma Paradigm one occurrence asks for: every Variation Dimension the
 * route's Paradigm Policy names, with the Lemma's stored Paradigm and its
 * other Readings, so dumgen writes a first Reading's forms and has a later
 * Reading's licences judged against the stored variants. As with the
 * structural aspects, only the occurrence that created the Reading (`New`)
 * asks; a route with no dimensions asks nothing.
 */
export function paradigmRequestFor(input: {
	readonly reading: Dumling.Reading<"de">;
	readonly origin: KnowledgeOrigin;
	/** The Lemma's stored Paradigm, if it has one. */
	readonly stored?: Dumrel.LemmaParadigm;
	/** The Lemma's stored Readings; this one may be among them. */
	readonly readings: readonly Dumling.Reading<"de">[];
}): ParadigmRequest | undefined {
	if (input.origin !== "New") return undefined;
	const dimensions = paradigmDimensions(input.reading.lemma);
	if (dimensions.length === 0) return undefined;
	return {
		dimensions,
		readings: input.readings,
		...(input.stored === undefined ? {} : { stored: input.stored }),
	};
}

/** Whether a request asks for nothing, so no model call is needed. */
export const isEmptyRequest = (request: Dumrel.KnowledgeRequestMask) =>
	Object.keys(request).length === 0;
