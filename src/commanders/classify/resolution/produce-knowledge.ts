/**
 * Knowledge for one committed occurrence (#64): ask dumgen's
 * `knowledge.produce` for what the stored entry lacks, and publish what
 * comes back. Base text (transcription, definition, translations) lands as
 * each aspect finishes, so an interrupted run keeps what it already paid
 * for and the next encounter asks only for the rest; structural aspects
 * and relations land together at the end. A run that breaks the Reading
 * down (`breakdownAskFor`) asks for its Source with the rest, then runs
 * dumgen's segmenters on what the Source leaves (`knowledge-breakdown.ts`),
 * and its Breakdown lands with the structural aspects. It runs after the
 * commit and the links, never on their path, as an action of its own: its
 * caller provides it one dumgen build (`Dumgen.provide`).
 */
import type { BreakdownSettled } from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import { authoredReading, closedRoute } from "dumcorpus/inventories";
import type { Jev, Luna } from "dumgen";
import { readingIdentityKey, routeOf } from "dumling";
import type * as Dumrel from "dumrel/types";
import { Effect } from "effect";
import type { DumgenOperations } from "../../../managers/dumgen";
import { breakDownReading } from "./knowledge-breakdown";
import {
	breakdownAskFor,
	isEmptyRequest,
	knowledgeRequestFor,
	PRODUCE_LEMMA_PARADIGM,
	PUBLISH_GENERATED_RELATIONS,
	paradigmRequestFor,
	type TranslationLanguage,
} from "./knowledge-request";
import type {
	DictionaryCommitFailed,
	GermanKnowledgeChange,
	KnowledgeJob,
	ResolutionStore,
} from "./knowledge-types";
import { publishKnowledge } from "./publish-knowledge";

const BASE_TEXT_ASPECTS = new Set([
	"transcription",
	"definition",
	"translations",
]);

/** What a run that asks `knowledge.produce` nothing has from it. */
const NOTHING_PRODUCED = {
	changes: [],
	failures: [],
	paradigmChanges: [],
	pendingRelations: [],
} as const;

type KnowledgeFailureSummary = {
	readonly aspect: string;
	readonly leaf?: string;
	readonly code: string;
};

export type KnowledgeOutcome =
	/** The stored entry already covers this occurrence: no model call. */
	| { readonly _tag: "Covered" }
	| {
			readonly _tag: "Published";
			/** The Reading's Breakdown is asked no more: it settled with none. */
			readonly breakdownSettled?: BreakdownSettled;
			readonly changes: number;
			readonly failures: readonly KnowledgeFailureSummary[];
			/** Relation parts that could not fit one commit even alone. */
			readonly dropped: number;
	  };

export type ProduceKnowledgeDeps = {
	/** dumgen's `operations`, which a test stubs. */
	readonly dumgen: Pick<DumgenOperations, "knowledge" | "segment">;
	readonly store: ResolutionStore;
	readonly translationLanguages: readonly TranslationLanguage[];
	readonly publishRelations?: boolean;
	/** Whether to ask for the Lemma Paradigm; {@link PRODUCE_LEMMA_PARADIGM} by default. */
	readonly produceParadigm?: boolean;
};

export const produceKnowledge = Effect.fnUntraced(function* (
	deps: ProduceKnowledgeDeps,
	job: KnowledgeJob,
): Effect.fn.Return<KnowledgeOutcome, DictionaryCommitFailed, Jev | Luna> {
	const publishRelations =
		deps.publishRelations ?? PUBLISH_GENERATED_RELATIONS;
	const { reading } = job;
	// A Closed Route's or an authored Reading's Knowledge is reviewed in
	// dumcorpus, never generated: dumgen answers a Catalog Miss for it.
	if (closedRoute(routeOf(reading.lemma)) || authoredReading(reading))
		return { _tag: "Covered" };
	const [location, note] = yield* Effect.all([
		deps.store.readingLocation(reading),
		deps.store.lemmaNote(reading.lemma),
	]);
	const key = readingIdentityKey(reading);
	const knowledge = location?.entry.knowledge;
	const breakdown = breakdownAskFor({
		reading,
		...(knowledge ? { knowledge } : {}),
		...(location?.breakdownSettled === undefined
			? {}
			: { settled: location.breakdownSettled }),
	});
	const masked = knowledgeRequestFor({
		origin: job.origin,
		publishRelations,
		reading,
		stored: {
			...(knowledge ? { knowledge } : {}),
			pendingRelationKinds: (note?.pendingRelations ?? []).flatMap(
				(record) =>
					readingIdentityKey(record.sourceReading) === key
						? [record.pending.relation]
						: [],
			),
		},
		translationLanguages: deps.translationLanguages,
	});
	// The Source comes first, with the rest of the Knowledge (ADR 0050).
	const request: Dumrel.KnowledgeRequestMask = breakdown?.source
		? { ...masked, source: null }
		: masked;
	if (isEmptyRequest(request) && breakdown === undefined)
		return { _tag: "Covered" };

	const published = new Set<string>();
	const publishBaseText = (changes: readonly GermanKnowledgeChange[]) =>
		Effect.suspend(() => {
			const base = changes.filter((change) =>
				BASE_TEXT_ASPECTS.has(change.aspect),
			);
			if (base.length === 0) return Effect.void;
			return publishKnowledge(deps.store, {
				changes: base,
				pendingRelations: [],
				reading,
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						for (const change of base)
							published.add(canonicalJson(change));
					}),
				),
				// A started commit settles before the run moves on; a failed one
				// is retried with the final publication.
				Effect.uninterruptible,
				Effect.catchTag("DictionaryCommitFailed", () => Effect.void),
			);
		});

	// The Lemma's stored Paradigm and its other Readings, so dumgen writes
	// a first Reading's forms and judges a later Reading's licences.
	const paradigm =
		(deps.produceParadigm ?? PRODUCE_LEMMA_PARADIGM)
			? paradigmRequestFor({
					origin: job.origin,
					reading,
					readings: (note?.readings ?? []).map(
						(entry) => entry.reading,
					),
					...(note?.paradigm === undefined
						? {}
						: { stored: note.paradigm }),
				})
			: undefined;
	const produced = isEmptyRequest(request)
		? NOTHING_PRODUCED
		: yield* deps.dumgen.knowledge.produce({
				attestation: job.attestation,
				language: "de",
				onContribution: publishBaseText,
				origin: job.origin,
				...(paradigm === undefined ? {} : { paradigm }),
				reading,
				request,
				sentence: job.sentence,
			});
	const brokenDown =
		breakdown === undefined
			? { changes: produced.changes, failures: [] }
			: yield* breakDownReading(
					{ segment: deps.dumgen.segment, store: deps.store },
					{
						produced,
						reading,
						sentence: job.sentence.segments
							.map(({ text }) => text)
							.join(""),
					},
				);
	const changes = brokenDown.changes.filter(
		(change) =>
			!published.has(canonicalJson(change)) &&
			(publishRelations || change.aspect !== "semanticRelations"),
	);
	const pendingRelations = publishRelations ? produced.pendingRelations : [];
	const final = yield* publishKnowledge(deps.store, {
		changes,
		paradigmChanges: produced.paradigmChanges,
		pendingRelations,
		reading,
	}).pipe(Effect.uninterruptible);
	const { settled } = brokenDown;
	if (settled !== undefined)
		// A marker that did not land only costs the next occurrence an ask.
		yield* deps.store.settleBreakdown(reading, settled).pipe(
			Effect.uninterruptible,
			Effect.catch((error) =>
				Effect.logWarning(
					`[Classify] The settled Breakdown of ${job.label} was not recorded:`,
					error,
				),
			),
		);
	return {
		_tag: "Published",
		...(settled === undefined ? {} : { breakdownSettled: settled }),
		changes: published.size + changes.length,
		dropped: final.dropped,
		failures: [...produced.failures, ...brokenDown.failures].flatMap(
			({ aspect, code, leaf }) =>
				code === "CatalogMiss"
					? []
					: [
							{
								aspect,
								code,
								...(leaf === undefined ? {} : { leaf }),
							},
						],
		),
	};
});
