/**
 * Classify's second stage (#64): the plugin's `UnitResolver`. It follows
 * tf-demo's resolved click (`server/linguisticOrchestration.ts`) for every
 * unit of the plan, then writes the links and hands Knowledge to the
 * background:
 *
 * 1. `resolve.grammar` names the unit's Attestation, with the stored
 *    Lemmas found under the Sentence's words as candidates.
 * 2. `resolve.reading` reuses one of the Lemma's stored Emoji Descriptions
 *    or writes a New one; a Foreign Lemma has its one Reading. The
 *    instances of a repeated Sentence share one judgement.
 * 3. Each occurrence commits through the dictionary store
 *    (`commitOccurrence`) with the Attestation Ref of its source block. A
 *    New the store refuses as stale is judged again, at most
 *    `MAX_STALE_REJUDGES` times.
 * 4. One compare-and-swap write links every piece of every resolved unit
 *    to its Reading note and adds the block IDs the refs name.
 * 5. Each resolved Reading's Knowledge runs in the background.
 *
 * Resolution is idempotent per occurrence: a second run over the same
 * occurrence reuses the Reading and adds nothing, so lazy click resolution
 * can later call it for one ref. While it runs, the Scroll is marked busy
 * (`ScrollActivity`), so its occurrences are not judged unlinked before its
 * links are written.
 */
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import type { Dumgen } from "dumgen";
import { parseUnit } from "dumling";
import type * as Dumling from "dumling/types";
import { Cause, Data, Effect, Option } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import type { ClassifyPlan, PlannedSentence, PlannedUnit } from "../types";
import {
	type UnitResolution,
	UnitResolver,
	UnitResolverError,
} from "../unit-resolver";
import { commitOccurrence } from "./commit-occurrence";
import type { KnowledgeQueue } from "./knowledge-queue";
import type { KnowledgeJob, ResolutionStore } from "./knowledge-types";
import type { ScrollActivity } from "./scroll-activity";
import type { ScrollFiles } from "./scroll-files";
import {
	attestationRefOf,
	type LinkedScroll,
	linkUnitsInScroll,
	type MintedBlockIds,
	mintBlockIds,
	occurrenceKeyOf,
	sourceBlocksOf,
	type UnitLinkEdit,
	withAppended,
} from "./scroll-links";

/** How often a unit judges its Reading again after its New was refused as stale. */
const MAX_STALE_REJUDGES = 2;

/** How often the link write runs again after losing a race. */
const MAX_LINK_WRITES = 3;

/** Units resolved at once; the store serializes their commits. */
const UNIT_CONCURRENCY = 3;

export type DumgenUnitResolverDeps = {
	readonly dumgen: Effect.Effect<Dumgen, UnitResolverError>;
	readonly store: Effect.Effect<ResolutionStore, UnitResolverError>;
	readonly scroll: ScrollFiles;
	readonly knowledge: Pick<KnowledgeQueue, "enqueue">;
	/** Told what the run could not do: links it skipped, a failed write. */
	readonly notify?: (message: string) => void;
	/** Marks each Scroll busy while a run resolves and links in it. */
	readonly activity?: ScrollActivity;
};

/** A unit resolution left unresolved, with the reason the user hears. */
class UnitPending extends Data.TaggedError("UnitPending")<{
	readonly reason: string;
}> {}

type ResolvedUnit = {
	readonly planned: PlannedUnit;
	readonly reading: Dumling.Reading<"de">;
	readonly attestation: Dumling.Attestation<"de">;
	readonly sentence: PlannedSentence;
	readonly created: boolean;
	readonly readingPath: string;
	readonly lemmaPath: string;
};

type UnitOutcome =
	| { readonly _tag: "Resolved"; readonly unit: ResolvedUnit }
	| { readonly _tag: "Pending"; readonly reason: string };

function readingOf(
	lemma: Dumling.Lemma<"de">,
	emojiDescription: string | undefined,
): Effect.Effect<Dumling.Reading<"de">, UnitPending> {
	const parsed = parseUnit({
		lemma,
		unitKind: "Reading",
		...(emojiDescription === undefined ? {} : { emojiDescription }),
	} as Dumling.Reading<"de">);
	return parsed.success
		? Effect.succeed(parsed.chain.value as Dumling.Reading<"de">)
		: Effect.fail(
				new UnitPending({
					reason: `dumling refused its Reading: ${parsed.error.message}`,
				}),
			);
}

const emojiDescriptionOf = (reading: Dumling.Reading<"de">) =>
	"emojiDescription" in reading ? reading.emojiDescription : undefined;

const labelOf = (reading: Dumling.Reading<"de">) =>
	[reading.lemma.canonicalForm, emojiDescriptionOf(reading)]
		.filter(Boolean)
		.join(" ");

/** The texts of a Sentence's words, under which stored Lemmas are candidates. */
function wordsOf(sentence: PlannedSentence): string[] {
	return [
		...new Set(
			sentence.segmented.segments.flatMap((segment) =>
				segment.kind === "ResolvableText"
					? [
							segment.text,
							...(segment.surface ? [segment.surface] : []),
						]
					: [],
			),
		),
	];
}

const pendingOnFailure =
	(what: string) =>
	(error: { readonly message: string }): UnitPending =>
		new UnitPending({ reason: `${what}: ${error.message}` });

/** The Reading a unit commits under, and how it was decided. */
type Decided = {
	readonly decision: "New" | "Reuse";
	readonly reading: Dumling.Reading<"de">;
	/** For a judged Reading: the stored Emoji Descriptions the judge saw. */
	readonly seen?: readonly string[];
};

/** What dumgen judged a unit: its Attestation and the Reading to commit it under. */
type JudgedUnit = {
	readonly attestation: Dumling.Attestation<"de">;
	readonly sentence: PlannedSentence;
	readonly decided: Decided;
	/** Judges the Reading again over `candidates`, keeping a description already `written`. */
	readonly judge: (
		candidates: readonly string[],
		written?: string,
	) => Effect.Effect<Decided, UnitPending>;
};

/** One judgement per `UnitRef`: the instances of a repeated Sentence share it. */
const judgementKeyOf = ({ ref }: PlannedUnit) =>
	JSON.stringify([ref.sentenceKey, ref.segments]);

/** Asks dumgen for a unit's grammar and Reading; writes nothing. */
const judgeUnit = Effect.fnUntraced(function* (
	dumgen: Dumgen,
	store: ResolutionStore,
	plan: ClassifyPlan,
	planned: PlannedUnit,
): Effect.fn.Return<JudgedUnit, UnitPending> {
	const sentence = plan.sentences.get(planned.ref.sentenceKey);
	if (!sentence)
		return yield* new UnitPending({
			reason: "its Sentence was not segmented",
		});
	if (planned.unit.route === "Unresolved")
		return yield* new UnitPending({
			reason: "segmentation left its route unresolved",
		});
	const lemmaCandidates = yield* store.lemmaCandidates(wordsOf(sentence));
	const grammar = yield* dumgen.resolve
		.grammar({
			language: "de",
			lemmaCandidates,
			neighbours: sentence.neighbours,
			sentence: sentence.segmented,
			unit: planned.unit,
		})
		.pipe(
			Effect.mapError(
				pendingOnFailure("dumgen could not resolve its grammar"),
			),
		);
	if (grammar._tag === "Unresolved")
		return yield* new UnitPending({
			reason: "dumgen left its grammar unresolved",
		});
	if (grammar._tag === "CatalogMiss")
		return yield* new UnitPending({ reason: grammar.message });
	const { attestation } = grammar;
	const lemma = attestation.surface.lemma;

	const judge = (candidates: readonly string[], written?: string) =>
		dumgen.resolve
			.reading({
				attestation,
				candidates,
				sentence: sentence.segmented,
				unit: planned.unit,
				...(written === undefined
					? grammar.drafted === undefined
						? {}
						: { drafted: grammar.drafted }
					: { written }),
			})
			.pipe(
				Effect.mapError(
					pendingOnFailure("dumgen could not resolve its Reading"),
				),
				Effect.flatMap((resolution) =>
					resolution._tag === "CatalogMiss"
						? Effect.fail(
								new UnitPending({ reason: resolution.message }),
							)
						: readingOf(lemma, resolution.emojiDescription).pipe(
								Effect.map((reading) => ({
									decision: resolution._tag,
									reading,
									seen: candidates,
								})),
							),
				),
			);

	const stored = yield* store.lemmaNote(lemma);
	let decided: Decided;
	if (lemma.family === "Foreign") {
		// A Foreign Lemma has exactly one Reading, without an Emoji Description.
		decided = {
			decision: (stored?.readings.length ?? 0) > 0 ? "Reuse" : "New",
			reading: yield* readingOf(lemma, undefined),
		};
	} else {
		decided = yield* judge(
			(stored?.readings ?? []).flatMap(({ reading }) => {
				const description = emojiDescriptionOf(reading);
				return description === undefined ? [] : [description];
			}),
		);
	}
	return { attestation, decided, judge, sentence };
});

/** Commits one occurrence of a judged unit; never writes to the Scroll. */
const commitUnit = Effect.fnUntraced(function* (
	store: ResolutionStore,
	judged: JudgedUnit,
	planned: PlannedUnit,
	/** The Segment's source block as an embed; none when the block cannot carry an ID. */
	attestationRef: string | undefined,
): Effect.fn.Return<ResolvedUnit, UnitPending> {
	const { attestation, judge, sentence } = judged;
	let decided = judged.decided;
	let created = false;
	for (let rejudged = 0; ; rejudged++) {
		const committed = yield* commitOccurrence(store, {
			...(attestationRef === undefined ? {} : { attestationRef }),
			decision: decided.decision,
			reading: decided.reading,
			surface: attestation.surface,
			...(decided.seen === undefined ? {} : { seen: decided.seen }),
		}).pipe(Effect.mapError(pendingOnFailure("the dictionary refused it")));
		if (committed._tag === "Committed") {
			created = committed.created;
			break;
		}
		// A New whose judge saw fewer Readings than the Lemma has now is
		// judged again; a second NoMatch keeps the description already
		// written (ADR 0031).
		if (rejudged === MAX_STALE_REJUDGES)
			return yield* new UnitPending({
				reason: "its Lemma kept gaining Readings while it resolved; Classify it again",
			});
		decided = yield* judge(
			committed.candidates,
			emojiDescriptionOf(decided.reading),
		);
	}

	const location = yield* store.readingLocation(decided.reading);
	if (!location)
		return yield* new UnitPending({
			reason: "its Reading was committed but its note is not readable",
		});
	return {
		attestation,
		created,
		lemmaPath: location.lemmaPath,
		planned,
		reading: decided.reading,
		readingPath: location.path,
		sentence,
	};
});

/**
 * Runs a pure transform over the Scroll until it lands or stops losing
 * races, and answers what its last run computed.
 */
const processScroll = Effect.fnUntraced(function* <
	A extends { readonly content: string },
>(scroll: ScrollFiles, scrollPath: string, transform: (current: string) => A) {
	let last: A | undefined;
	for (let attempt = 1; ; attempt++) {
		const written = yield* scroll
			.process(scrollPath, (current) => {
				last = transform(current);
				return last.content;
			})
			.pipe(Effect.result);
		if (written._tag === "Success") return Option.fromNullishOr(last);
		if (!written.failure.conflict || attempt >= MAX_LINK_WRITES)
			return yield* written.failure;
	}
});

export function dumgenUnitResolver(
	deps: DumgenUnitResolverDeps,
): UnitResolver["Service"] {
	return UnitResolver.of({
		resolve: Effect.fn("dumgenUnitResolver.resolve")(
			function* (plan) {
				const dumgen = yield* deps.dumgen;
				const store = yield* deps.store;
				const firstOf = (planned: PlannedUnit) =>
					planned.occurrences[0]?.from ?? 0;
				const blocks = sourceBlocksOf(
					plan.content,
					plan.units.map(firstOf),
				);
				// Blocks get their IDs before anything commits, so every
				// Attestation Ref names a block the Scroll holds.
				const mintAts = plan.units.flatMap((planned) => {
					const block = blocks.get(firstOf(planned));
					return planned.unit.route !== "Unresolved" &&
						block?._tag === "Unidentified"
						? [block.mintAt]
						: [];
				});
				const minted: MintedBlockIds = Option.getOrElse(
					mintAts.length === 0
						? Option.none<MintedBlockIds>()
						: yield* processScroll(
								deps.scroll,
								plan.scrollPath,
								(current) =>
									mintBlockIds({
										current,
										mintAts,
										snapshot: plan.content,
									}),
							).pipe(
								Effect.catchTag("ScrollWriteFailed", (error) =>
									Effect.sync(() => {
										deps.notify?.(
											`⚠ Could not add block IDs to ${plan.scrollPath}; their units are saved without an Attestation: ${error.message}`,
										);
										return Option.none<MintedBlockIds>();
									}),
								),
							),
					() => ({
						appended: [],
						content: plan.content,
						ids: new Map(),
					}),
				);
				const refOf = (planned: PlannedUnit) => {
					const block = blocks.get(firstOf(planned));
					const id =
						block?._tag === "Identified"
							? block.id
							: block?._tag === "Unidentified"
								? minted.ids.get(block.mintAt)
								: undefined;
					return id === undefined
						? undefined
						: attestationRefOf(
								plan.scrollPath,
								id,
								occurrenceKeyOf(planned.ref, planned.instance),
							);
				};
				const judgements = new Map<
					string,
					Effect.Effect<JudgedUnit, UnitPending>
				>();
				for (const planned of plan.units)
					if (!judgements.has(judgementKeyOf(planned)))
						judgements.set(
							judgementKeyOf(planned),
							yield* Effect.cached(
								judgeUnit(dumgen, store, plan, planned),
							),
						);
				const outcomes = yield* Effect.forEach(
					plan.units,
					(planned): Effect.Effect<UnitOutcome> =>
						(
							judgements.get(judgementKeyOf(planned)) ??
							judgeUnit(dumgen, store, plan, planned)
						).pipe(
							Effect.flatMap((judged) =>
								commitUnit(
									store,
									judged,
									planned,
									refOf(planned),
								),
							),
							Effect.map(
								(unit) => ({ _tag: "Resolved", unit }) as const,
							),
							Effect.catchCause((cause) =>
								Cause.hasInterruptsOnly(cause)
									? Effect.interrupt
									: Effect.succeed({
											_tag: "Pending",
											reason: Option.match(
												Cause.findErrorOption(cause),
												{
													onNone: () =>
														`resolution failed unexpectedly: ${formatCause(cause, { stack: false })}`,
													onSome: (error) =>
														error.reason,
												},
											),
										} as const),
							),
						),
					{ concurrency: UNIT_CONCURRENCY },
				);

				const resolved = outcomes.flatMap((outcome) =>
					outcome._tag === "Resolved" ? [outcome.unit] : [],
				);
				// Links map from the snapshot as the mint write left it.
				const snapshot = withAppended(plan.content, minted.appended);
				const edits: UnitLinkEdit[] = resolved.map((unit) => ({
					occurrences: unit.planned.occurrences.map(snapshot.move),
					ref: unit.planned.ref,
					target: { readingPath: unit.readingPath },
				}));
				const linked =
					edits.length === 0
						? Option.none<LinkedScroll>()
						: yield* processScroll(
								deps.scroll,
								plan.scrollPath,
								(current) =>
									linkUnitsInScroll({
										current,
										edits,
										snapshot: snapshot.content,
										...(plan.userLinks === undefined
											? {}
											: { userLinks: plan.userLinks }),
									}),
							).pipe(
								Effect.catchTag("ScrollWriteFailed", (error) =>
									Effect.sync(() => {
										deps.notify?.(`⚠ ${error.message}`);
										return Option.none<LinkedScroll>();
									}),
								),
							);
				if (Option.isSome(linked) && linked.value.skipped.length > 0)
					deps.notify?.(
						`⚠ Left ${linked.value.skipped.length} occurrence${linked.value.skipped.length === 1 ? "" : "s"} unlinked: ${[...new Set(linked.value.skipped.map(({ reason, text }) => `${text} (${reason})`))].join(", ")}`,
					);

				// The occurrence that created a Reading asks for its whole
				// Knowledge; the queue joins later occurrences of the same Reading.
				const jobs: KnowledgeJob[] = [...resolved]
					.sort((a, b) => Number(b.created) - Number(a.created))
					.map((unit) => ({
						attestation: unit.attestation,
						label: labelOf(unit.reading),
						origin: unit.created ? "New" : "TopUp",
						reading: unit.reading,
						readingPath: unit.readingPath,
						sentence: {
							segments: unit.sentence.segmented.segments.map(
								({ text }) => ({
									text,
								}),
							),
							target: [...unit.planned.unit.segments],
						},
					}));
				for (const job of jobs) deps.knowledge.enqueue(job);

				let index = 0;
				return outcomes.map((outcome, position): UnitResolution => {
					const ref = plan.units[position]?.ref ?? {
						segments: [],
						sentenceKey: "",
					};
					if (outcome._tag === "Pending")
						return { _tag: "Pending", reason: outcome.reason, ref };
					const linkedCount = Option.match(linked, {
						onNone: () => 0,
						onSome: (scroll) => scroll.linked[index] ?? 0,
					});
					index++;
					return {
						_tag: "Resolved",
						lemmaPath: outcome.unit.lemmaPath,
						linked: linkedCount,
						readingPath: outcome.unit.readingPath,
						ref,
					};
				});
			},
			Effect.mapError((cause) =>
				cause instanceof UnitResolverError
					? cause
					: new UnitResolverError({
							cause,
							message: getErrorMessage(cause),
						}),
			),
			(effect, plan) => {
				const { activity } = deps;
				return activity === undefined
					? effect
					: Effect.acquireUseRelease(
							Effect.sync(() => activity.begin(plan.scrollPath)),
							() => effect,
							(end) => Effect.sync(end),
						);
			},
		),
	});
}
