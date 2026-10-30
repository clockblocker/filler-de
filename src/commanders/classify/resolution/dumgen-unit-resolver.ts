/**
 * Classify's second stage (#64): the plugin's `UnitResolver`. It follows
 * tf-demo's resolved click (`server/linguisticOrchestration.ts`) for every
 * unit of the plan, then writes the links and, when it attests, hands
 * Knowledge to the background:
 *
 * 1. `resolve.grammar` names the unit's Attestation, with the stored
 *    Lemmas found under the Sentence's words as candidates.
 * 2. `resolve.reading` reuses one of the Lemma's stored Emoji Descriptions
 *    or writes a New one; a Foreign Lemma has its one Reading. The
 *    instances of a repeated Sentence share one judgement. Up to
 *    `UNIT_CONCURRENCY` units run at once, but a unit judges its Reading
 *    and commits under its Lemma's lock, so units of one Lemma take turns.
 * 3. Each occurrence commits through the dictionary store
 *    (`commitOccurrence`). A New the store refuses as stale is judged
 *    again, at most `MAX_STALE_REJUDGES` times.
 * 4. One compare-and-swap write links every piece of every resolved unit
 *    to its Reading note.
 * 5. Each attested occurrence's Reading has its Knowledge asked for in the
 *    background, with that Attestation as its context.
 *
 * When an occurrence becomes an Attestation is the plan's `attest` (#281).
 * The command's Classify (`OnClick`) gives none an Attestation Ref, nor a
 * block ID: one its click already attested keeps its ref, and each
 * judgement goes into the judgement cache. The click (`Clicked`) resolves
 * its one occurrence from that cache, judging again only on a miss; the
 * dictionary reset (`Now`) attests as it links. The command's Classify
 * asks no Knowledge; the click and the reset do. Attesting, the block IDs the refs name are added before anything
 * commits; a paragraph of several Sentences is first cut into sentence
 * blocks, so each ref names its occurrence's Sentence.
 *
 * Resolution is idempotent per occurrence: a second run over the same
 * occurrence reuses the Reading and adds nothing, so lazy click resolution
 * can later call it for one ref. While it runs, the Scroll is marked busy
 * (`ScrollActivity`), so its occurrences are not judged unlinked before its
 * links are written.
 */
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import type { Jev, Luna } from "dumgen";
import { lemmaIdentityKey, parseUnit } from "dumling";
import type * as Dumling from "dumling/types";
import {
	Cause,
	Data,
	Effect,
	Option,
	Predicate,
	Schedule,
	Semaphore,
} from "effect";
import type { DumgenOperations } from "../../../managers/dumgen";
import { getErrorMessage } from "../../../utils/get-error-message";
import type { JudgementCache } from "../judgement-cache";
import type { ClassifyPlan, PlannedSentence, PlannedUnit } from "../types";
import {
	type UnitResolution,
	UnitResolver,
	UnitResolverError,
} from "../unit-resolver";
import { commitOccurrence, optionallyReflexiveOf } from "./commit-occurrence";
import type { KnowledgeQueue } from "./knowledge-queue";
import type { KnowledgeJob, ResolutionStore } from "./knowledge-types";
import type { ScrollActivity } from "./scroll-activity";
import type { ScrollFiles } from "./scroll-files";
import {
	attestationRefOf,
	type LinkedScroll,
	linkMinted,
	type MintedBlockIds,
	mintBlockIds,
	occurrenceKeyOf,
	sourceBlocksOf,
	type UnitLinkEdit,
} from "./scroll-links";

/** How often a unit judges its Reading again after its New was refused as stale. */
const MAX_STALE_REJUDGES = 2;

/** How often the link write runs again after losing a race. */
const MAX_LINK_WRITES = 3;

/** How long a rate-limited judgement waits before its one retry. */
const RATE_LIMIT_PAUSE = "2 seconds";

/** Units resolved at once; each Lemma's lock serializes its own. */
const UNIT_CONCURRENCY = 12;

export type DumgenUnitResolverDeps = {
	/** dumgen's `operations`, which a test stubs; they run on the caller's build. */
	readonly dumgen: Pick<DumgenOperations, "resolve">;
	readonly store: Effect.Effect<ResolutionStore, UnitResolverError>;
	readonly scroll: ScrollFiles;
	readonly knowledge: Pick<KnowledgeQueue, "enqueueAll">;
	/** Told what the run could not do: links it skipped, a failed write. */
	readonly notify?: (message: string) => void;
	/** Marks each Scroll busy while a run resolves and links in it. */
	readonly activity?: ScrollActivity;
	/** Where each occurrence's judgement is kept for its click (#281). */
	readonly judgements?: JudgementCache["Service"];
};

/** A unit resolution left unresolved, with the reason the user hears. */
class UnitPending extends Data.TaggedError("UnitPending")<{
	readonly reason: string;
}> {}

type ResolvedUnit = {
	/** Whether its Reading asks for its whole Knowledge: it was created, or has none yet. */
	readonly whole: boolean;
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
	/**
	 * Judges the Reading again over `candidates`, those of them with an
	 * Optional Reflexive Slot named, keeping a description already
	 * `written`.
	 */
	readonly judge: (
		candidates: readonly string[],
		optionallyReflexive: readonly string[],
		written?: string,
	) => Effect.Effect<Decided, UnitPending, Jev | Luna>;
};

/**
 * A unit whose grammar dumgen judged: its Attestation names its Lemma, and
 * `decide` judges its Reading. Deciding and committing run under the
 * Lemma's lock, so units of one Lemma judge against each other's Readings
 * rather than end stale.
 */
type GrammarJudged = {
	readonly attestation: Dumling.Attestation<"de">;
	/** Decides the Reading once; every caller shares that one decision. */
	readonly decide: Effect.Effect<JudgedUnit, UnitPending, Jev | Luna>;
};

const decided = (judged: JudgedUnit): GrammarJudged => ({
	attestation: judged.attestation,
	decide: Effect.succeed(judged),
});

/** The HTTP statuses of a provider that is rate limiting or overloaded. */
const RATE_LIMITED = /\b(?:429|503|529)\b/u;

/**
 * Whether dumgen failed for a provider that is rate limiting or
 * overloaded: a `ProviderFailure` whose cause carries such a `status`, as
 * jev's does, or names it, as Luna's message does ("OpenAI answered 429").
 */
export const isRateLimited = (error: unknown): boolean => {
	if (!Predicate.isTagged(error, "ProviderFailure")) return false;
	const cause = Predicate.hasProperty(error, "cause")
		? error.cause
		: undefined;
	if (
		Predicate.hasProperty(cause, "status") &&
		Predicate.isNumber(cause.status)
	)
		return RATE_LIMITED.test(String(cause.status));
	return (
		Predicate.hasProperty(error, "message") &&
		Predicate.isString(error.message) &&
		/answered (?:429|503|529)\b/u.test(error.message)
	);
};

/**
 * One more try, after a pause, for a judgement the provider refused as
 * rate limited or overloaded, before the unit goes Pending.
 */
const retryRateLimited = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.retry(effect, {
		schedule: Schedule.exponential(RATE_LIMIT_PAUSE),
		times: 1,
		while: isRateLimited,
	});

/** One judgement per `UnitRef`: the instances of a repeated Sentence share it. */
const judgementKeyOf = ({ ref }: PlannedUnit) =>
	JSON.stringify([ref.sentenceKey, ref.segments]);

/**
 * Asks dumgen for a unit's grammar, and answers how to ask for its Reading;
 * writes nothing.
 */
const judgeUnit = Effect.fnUntraced(function* (
	dumgen: DumgenUnitResolverDeps["dumgen"],
	store: ResolutionStore,
	plan: ClassifyPlan,
	planned: PlannedUnit,
	/** The Reading a clicked link opens: its occurrence goes to it, judged by grammar alone. */
	linked?: Dumling.Reading<"de">,
): Effect.fn.Return<GrammarJudged, UnitPending, Jev | Luna> {
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
			retryRateLimited,
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
	if (linked)
		return lemmaIdentityKey(linked.lemma) === lemmaIdentityKey(lemma)
			? decided(clickedAs(attestation, linked, sentence))
			: yield* new UnitPending({
					reason: "its link opens a Reading of another Lemma than dumgen judged it; Classify it again",
				});

	const judge = (
		candidates: readonly string[],
		optionallyReflexive: readonly string[],
		written?: string,
	) =>
		dumgen.resolve
			.reading({
				attestation,
				candidates,
				...(optionallyReflexive.length === 0
					? {}
					: { optionallyReflexive }),
				sentence: sentence.segmented,
				unit: planned.unit,
				...(written === undefined
					? grammar.drafted === undefined
						? {}
						: { drafted: grammar.drafted }
					: { written }),
			})
			.pipe(
				retryRateLimited,
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

	// Judged from the Lemma's Readings as they stand under its lock.
	const decide = Effect.gen(function* () {
		const stored = yield* store.lemmaNote(lemma);
		let reading: Decided;
		if (lemma.family === "Foreign") {
			// A Foreign Lemma has exactly one Reading, without an Emoji Description.
			reading = {
				decision: (stored?.readings.length ?? 0) > 0 ? "Reuse" : "New",
				reading: yield* readingOf(lemma, undefined),
			};
		} else {
			const readings = stored?.readings ?? [];
			reading = yield* judge(
				readings.flatMap(({ reading }) => {
					const description = emojiDescriptionOf(reading);
					return description === undefined ? [] : [description];
				}),
				optionallyReflexiveOf(readings),
			);
		}
		return { attestation, decided: reading, judge, sentence };
	});
	return { attestation, decide: yield* Effect.cached(decide) };
});

/** Where the judgement cache keeps a planned unit's judgement. */
const judgedAt = (planned: PlannedUnit) => ({
	occurrence: occurrenceKeyOf(planned.ref, planned.instance),
	sentenceKey: planned.ref.sentenceKey,
});

/** A clicked occurrence of `reading`, which is reused, created again if it went. */
const clickedAs = (
	attestation: Dumling.Attestation<"de">,
	reading: Dumling.Reading<"de">,
	sentence: PlannedSentence,
): JudgedUnit => ({
	attestation,
	decided: { decision: "Reuse", reading },
	// A reused Reading is never refused as stale.
	judge: () =>
		Effect.fail(
			new UnitPending({ reason: "its clicked Reading was refused" }),
		),
	sentence,
});

/**
 * A clicked unit's judgement as the cache kept it when Classify linked it,
 * given to `linked`, the Reading its link opens, when that is stored and
 * of the same Lemma. None on a miss, or for a Reading of another Lemma.
 */
const cachedJudgement = Effect.fnUntraced(function* (
	judgements: JudgementCache["Service"] | undefined,
	plan: ClassifyPlan,
	planned: PlannedUnit,
	linked: Dumling.Reading<"de"> | undefined,
) {
	const sentence = plan.sentences.get(planned.ref.sentenceKey);
	if (!judgements || !sentence) return Option.none<JudgedUnit>();
	const cached = yield* judgements.get(judgedAt(planned));
	return Option.flatMap(cached, ({ attestation, reading }) =>
		linked === undefined
			? Option.some(clickedAs(attestation, reading, sentence))
			: lemmaIdentityKey(linked.lemma) ===
					lemmaIdentityKey(attestation.surface.lemma)
				? Option.some(clickedAs(attestation, linked, sentence))
				: Option.none(),
	);
});

/**
 * The stored Reading whose note is at `path`: Reading notes sit in their
 * Lemma note's folder. None when no stored Reading has it.
 */
const readingAtPath = Effect.fnUntraced(function* (
	store: ResolutionStore,
	path: string,
) {
	const folderOf = (of: string) => of.slice(0, of.lastIndexOf("/"));
	for (const note of yield* store.lemmaNotes) {
		if (folderOf(note.path) !== folderOf(path)) continue;
		for (const { reading } of (yield* store.lemmaNote(note.lemma))
			?.readings ?? [])
			if ((yield* store.readingLocation(reading))?.path === path)
				return reading;
	}
	return undefined;
});

/**
 * The Segment's source block as an embed, given the link path that names
 * the Scroll; none when the block cannot carry an ID.
 */
type RefOf = ((linkpath: string) => string) | undefined;

/** Commits one occurrence of a judged unit; never writes to the Scroll. */
const commitUnit = Effect.fnUntraced(function* (
	store: ResolutionStore,
	judged: JudgedUnit,
	planned: PlannedUnit,
	scrollPath: string,
	refOf: RefOf,
	onlyIfAttested: boolean,
): Effect.fn.Return<ResolvedUnit, UnitPending, Jev | Luna> {
	const { attestation, judge, sentence } = judged;
	let decided = judged.decided;
	let created = false;
	for (let rejudged = 0; ; rejudged++) {
		// The ref names the Scroll as Obsidian opens it from the note it
		// goes in, its Reading's, as the store's rename rewrite does (#210).
		const names =
			refOf === undefined
				? undefined
				: yield* store.scrollRefNames(
						scrollPath,
						decided.reading,
						attestation.surface,
					);
		const committed = yield* commitOccurrence(store, {
			...(refOf === undefined || names === undefined
				? {}
				: {
						attestationRef: refOf(names.linkpath),
						scrollAliases: names.aliases,
						...(onlyIfAttested ? { onlyIfAttested } : {}),
					}),
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
			committed.optionallyReflexive,
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
		whole: created || location.entry.knowledge === undefined,
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

/** The Sentence and target a unit's Knowledge is asked for with. */
const knowledgeSentenceOf = (unit: ResolvedUnit): KnowledgeJob["sentence"] => ({
	segments: unit.sentence.segmented.segments.map(({ text }) => ({ text })),
	target: [...unit.planned.unit.segments],
});

export function dumgenUnitResolver(
	deps: DumgenUnitResolverDeps,
): UnitResolver["Service"] {
	// One lock per Lemma, across runs and clicks: a unit decides its Reading
	// and commits while it holds it, so the next unit of the Lemma judges
	// against the Reading it committed.
	// A Lemma's lock goes once no unit holds it or waits for it.
	const locks = new Map<
		string,
		{ readonly lock: Semaphore.Semaphore; users: number }
	>();
	const lockOf =
		(lemma: Dumling.Lemma<"de">) =>
		<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
			Effect.suspend(() => {
				const key = lemmaIdentityKey(lemma);
				let held = locks.get(key);
				if (!held) {
					held = { lock: Semaphore.makeUnsafe(1), users: 0 };
					locks.set(key, held);
				}
				const entry = held;
				entry.users++;
				return entry.lock
					.withPermits(1)(effect)
					.pipe(
						Effect.ensuring(
							Effect.sync(() => {
								entry.users--;
								if (
									entry.users === 0 &&
									locks.get(key) === entry
								)
									locks.delete(key);
							}),
						),
					);
			});
	return UnitResolver.of({
		resolve: Effect.fn("dumgenUnitResolver.resolve")(
			function* (plan) {
				const { dumgen } = deps;
				const store = yield* deps.store;
				const firstOf = (planned: PlannedUnit) =>
					planned.occurrences[0]?.from ?? 0;
				const blocks = sourceBlocksOf(
					plan.content,
					plan.units.map(firstOf),
				);
				// Blocks get their IDs before anything commits, so every
				// Attestation Ref names a block the Scroll holds. A paragraph
				// of several Sentences is cut into sentence blocks first, so
				// each occurrence's ID names its own Sentence.
				const attest = plan.attest ?? "OnClick";
				// Attesting on click, Classify cuts and mints nothing: the
				// click does, for its own Sentence.
				const unidentified =
					attest === "OnClick"
						? []
						: plan.units.flatMap((planned) => {
								const block = blocks.get(firstOf(planned));
								return planned.unit.route !== "Unresolved" &&
									block?._tag === "Unidentified"
									? [firstOf(planned)]
									: [];
							});
				const minted: MintedBlockIds = Option.getOrElse(
					unidentified.length === 0
						? Option.none<MintedBlockIds>()
						: yield* processScroll(
								deps.scroll,
								plan.scrollPath,
								(current) =>
									mintBlockIds({
										current,
										offsets: unidentified,
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
						content: plan.content,
						edits: [],
						ids: new Map(),
						relocations: [],
					}),
				);
				const refOf = (planned: PlannedUnit): RefOf => {
					const block = blocks.get(firstOf(planned));
					const id =
						block?._tag === "Identified"
							? block.id
							: block?._tag === "Unidentified"
								? minted.ids.get(firstOf(planned))
								: undefined;
					return id === undefined
						? undefined
						: (linkpath) =>
								attestationRefOf(
									plan.scrollPath,
									id,
									occurrenceKeyOf(
										planned.ref,
										planned.instance,
									),
									linkpath,
								);
				};
				const judgements = new Map<
					string,
					Effect.Effect<GrammarJudged, UnitPending, Jev | Luna>
				>();
				/** The clicked units judged by grammar alone, for the Reading their link opens. */
				const fromLinked = new Map<
					PlannedUnit,
					Effect.Effect<GrammarJudged, UnitPending, Jev | Luna>
				>();
				/** The units judged from the cache, which is not written again. */
				const fromCache = new Map<PlannedUnit, JudgedUnit>();
				// A click attests to the Reading its link opens while that is
				// stored: a judgement made again, on another device or after an
				// edit, would move the link off the Reading the user is reading.
				const clickedReading =
					attest === "Clicked" && plan.clickedReading !== undefined
						? yield* readingAtPath(store, plan.clickedReading)
						: undefined;
				for (const planned of plan.units) {
					const cached =
						attest === "Clicked"
							? yield* cachedJudgement(
									deps.judgements,
									plan,
									planned,
									clickedReading,
								)
							: Option.none<JudgedUnit>();
					if (Option.isSome(cached)) {
						fromCache.set(planned, cached.value);
						continue;
					}
					if (clickedReading) {
						fromLinked.set(
							planned,
							yield* Effect.cached(
								judgeUnit(
									dumgen,
									store,
									plan,
									planned,
									clickedReading,
								),
							),
						);
						continue;
					}
					if (!judgements.has(judgementKeyOf(planned)))
						judgements.set(
							judgementKeyOf(planned),
							yield* Effect.cached(
								judgeUnit(dumgen, store, plan, planned),
							),
						);
				}
				const judgedOf = (planned: PlannedUnit) => {
					const cached = fromCache.get(planned);
					return cached
						? Effect.succeed(decided(cached))
						: (fromLinked.get(planned) ??
								judgements.get(judgementKeyOf(planned)) ??
								judgeUnit(dumgen, store, plan, planned));
				};
				const outcomes = yield* Effect.forEach(
					plan.units,
					(planned): Effect.Effect<UnitOutcome, never, Jev | Luna> =>
						judgedOf(planned).pipe(
							Effect.flatMap(({ attestation, decide }) =>
								lockOf(attestation.surface.lemma)(
									decide.pipe(
										Effect.flatMap((judged) =>
											commitUnit(
												store,
												judged,
												planned,
												plan.scrollPath,
												refOf(planned),
												attest === "OnClick",
											),
										),
									),
								),
							),
							Effect.tap((unit) =>
								fromCache.has(planned) || !deps.judgements
									? Effect.void
									: deps.judgements.put(judgedAt(planned), {
											attestation: unit.attestation,
											reading: unit.reading,
											sentence: knowledgeSentenceOf(unit),
										}),
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
				const edits: UnitLinkEdit[] = resolved.map((unit) => ({
					occurrences: unit.planned.occurrences,
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
									linkMinted({
										current,
										edits,
										minted,
										snapshot: plan.content,
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

				// Knowledge is asked for by the click that attests an occurrence,
				// with it as the context, and by the dictionary reset, never by
				// the command's Classify (#281). A Reading without Knowledge yet,
				// as Classify leaves it, asks for its whole; the queue joins a
				// run already going, and a Reading whose Knowledge covers what
				// it may ask asks nothing.
				if (attest !== "OnClick")
					yield* deps.knowledge.enqueueAll(
						[...resolved]
							.sort((a, b) => Number(b.whole) - Number(a.whole))
							.map((unit) => ({
								attestation: unit.attestation,
								label: labelOf(unit.reading),
								origin: unit.whole ? "New" : "TopUp",
								reading: unit.reading,
								readingPath: unit.readingPath,
								sentence: knowledgeSentenceOf(unit),
							})),
					);

				let index = 0;
				return outcomes.map((outcome, position): UnitResolution => {
					const ref = plan.units[position]?.ref ?? {
						occurrenceSentenceKey: "",
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
					: activity.during(plan.scrollPath, effect);
			},
		),
	});
}
