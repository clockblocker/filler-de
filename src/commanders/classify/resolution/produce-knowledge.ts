/**
 * Knowledge for one committed occurrence (#64): ask dumgen's
 * `knowledge.produce` for what the stored entry lacks, and publish what
 * comes back. Base text (transcription, definition, translations) lands as
 * each aspect finishes, so an interrupted run keeps what it already paid
 * for and the next encounter asks only for the rest; structural aspects
 * and relations land together at the end. It runs after the commit and the
 * links, never on their path.
 */
import { canonicalJson } from "common-utils";
import type { Dumgen } from "dumgen";
import { readingIdentityKey } from "dumling";
import { Effect } from "effect";
import {
	isEmptyRequest,
	knowledgeRequestFor,
	PUBLISH_GENERATED_RELATIONS,
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

export type KnowledgeFailureSummary = {
	readonly aspect: string;
	readonly leaf?: string;
	readonly code: string;
};

export type KnowledgeOutcome =
	/** The stored entry already covers this occurrence: no model call. */
	| { readonly _tag: "Covered" }
	| {
			readonly _tag: "Published";
			readonly changes: number;
			readonly failures: readonly KnowledgeFailureSummary[];
			/** Relation parts that could not fit one commit even alone. */
			readonly dropped: number;
	  };

export type ProduceKnowledgeDeps = {
	readonly dumgen: Dumgen;
	readonly store: ResolutionStore;
	readonly translationLanguages: readonly TranslationLanguage[];
	readonly publishRelations?: boolean;
};

export const produceKnowledge = Effect.fnUntraced(function* (
	deps: ProduceKnowledgeDeps,
	job: KnowledgeJob,
): Effect.fn.Return<KnowledgeOutcome, DictionaryCommitFailed> {
	const publishRelations =
		deps.publishRelations ?? PUBLISH_GENERATED_RELATIONS;
	const { reading } = job;
	const [location, note] = yield* Effect.all([
		deps.store.readingLocation(reading),
		deps.store.lemmaNote(reading.lemma),
	]);
	const key = readingIdentityKey(reading);
	const request = knowledgeRequestFor({
		origin: job.origin,
		publishRelations,
		reading,
		stored: {
			...(location?.entry.knowledge
				? { knowledge: location.entry.knowledge }
				: {}),
			pendingRelationKinds: (note?.pendingRelations ?? []).flatMap(
				(record) =>
					readingIdentityKey(record.sourceReading) === key
						? [record.pending.relation]
						: [],
			),
		},
		translationLanguages: deps.translationLanguages,
	});
	if (isEmptyRequest(request)) return { _tag: "Covered" };

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

	const produced = yield* deps.dumgen.knowledge.produce({
		attestation: job.attestation,
		language: "de",
		onContribution: publishBaseText,
		origin: job.origin,
		reading,
		request,
		sentence: job.sentence,
	});
	const changes = produced.changes.filter(
		(change) =>
			!published.has(canonicalJson(change)) &&
			(publishRelations || change.aspect !== "semanticRelations"),
	);
	const pendingRelations = publishRelations ? produced.pendingRelations : [];
	const final = yield* publishKnowledge(deps.store, {
		changes,
		pendingRelations,
		reading,
	}).pipe(Effect.uninterruptible);
	return {
		_tag: "Published",
		changes: published.size + changes.length,
		dropped: final.dropped,
		failures: produced.failures.map(({ aspect, code, leaf }) => ({
			aspect,
			code,
			...(leaf === undefined ? {} : { leaf }),
		})),
	};
});
