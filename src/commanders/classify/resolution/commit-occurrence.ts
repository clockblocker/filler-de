/**
 * Commits one resolved occurrence to the dictionary (#64), as tf-demo's
 * `planAndCommitDictionary` does inside its transaction: a New Reading
 * becomes a new Reading Entry owning the attested Surface, and a reused
 * Reading records the occurrence (`recordOccurrence`), which ensures its
 * Lemma owns the Surface. Either way the Reading holds the occurrence's
 * Attestation Link `{ ref, surfaceId, reading }` (texteater#1227), and its
 * Reading note shows the ref under Deine Kontexte.
 *
 * A ref names one occurrence, once in the dictionary. An occurrence judged
 * a different Reading than it was recorded under moves: it is removed
 * (`removeOccurrence`, with its cascade, which the store follows with the
 * Shadow re-evaluation a removal asks for) and recorded again. One judged
 * the same Reading under another Surface keeps its link.
 *
 * Each occurrence is one store transaction (`transact`): it plans from the
 * store's view and commits under the store's lock, so no other commit
 * lands in between, and plans again, a bounded number of times, only when
 * the commit meets a change made outside the store. A New whose judge
 * never saw a Reading the Lemma has gained since stops the transaction
 * before anything is written, and its caller judges again (ADR 0031),
 * outside the lock.
 */
import {
	type DictionaryCommitError,
	type DictionaryTransactionConflict,
	type DictionaryView,
	type ScrollAlias,
	storedRefFor,
	Transaction,
} from "@textfresser/dictionary";
import type { AttestationLink } from "dumdict";
import {
	createDumdictPlanner,
	type DumdictPlanOutcome,
	makeSurfaceId,
	type ReadingEntryContext,
} from "dumdict/planning";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Effect, Result } from "effect";
import {
	DictionaryCommitFailed,
	type ResolutionStore,
} from "./knowledge-types";

/** Plans a transaction tries before the occurrence gives up. */
export const MAX_COMMIT_ATTEMPTS = 4;

const planner = createDumdictPlanner("de");

const emptySurfaceNote = () => ({
	attestations: [] as string[],
	attestedTranslations: [] as string[],
	notes: "",
});

const emptyReadingNote = () => ({
	attestationLinks: [],
	attestedTranslations: [] as string[],
	notes: "",
});

export type OccurrenceCommit = {
	readonly reading: Dumling.Reading<"de">;
	readonly decision: "New" | "Reuse";
	/** For a New the judge decided: the stored Emoji Descriptions it saw. */
	readonly seen?: readonly string[];
	readonly surface: Dumling.Surface<"de">;
	/** The occurrence's Attestation Ref; none when its block cannot carry an ID. */
	readonly attestationRef?: string;
	/**
	 * Every link path stored refs may name the occurrence's Scroll by, with
	 * the Reading note it opens the Scroll from (`ScrollRefNames.aliases`).
	 * A stored ref of the same occurrence that names the Scroll by one of
	 * them, in that note, stands for `attestationRef`, so the occurrence
	 * never gets a second ref (#198, #210).
	 */
	readonly scrollAliases?: readonly ScrollAlias[];
};

export type OccurrenceCommitted =
	| {
			readonly _tag: "Committed";
			/** Whether this commit created the Reading. */
			readonly created: boolean;
	  }
	| {
			/** The New was refused; `candidates` are the Lemma's stored Emoji Descriptions now. */
			readonly _tag: "Stale";
			readonly candidates: readonly string[];
			/** The candidates with an Optional Reflexive Slot. */
			readonly optionallyReflexive: readonly string[];
	  };

type Planned = Result.Result<
	Transaction<OccurrenceCommitted>,
	DictionaryCommitFailed
>;

const MOVED = "The occurrence moved from another Reading";

const unchanged: OccurrenceCommitted = { _tag: "Committed", created: false };

const failed = (message: string) => (cause: unknown) =>
	new DictionaryCommitFailed({ cause, message });

/**
 * A transaction's failure as resolution reports it: a conflict that
 * outlasted its attempts says what kept changing while `what`.
 */
export const commitFailure =
	(what: string) =>
	(
		error:
			| DictionaryCommitFailed
			| DictionaryCommitError
			| DictionaryTransactionConflict,
	): DictionaryCommitFailed => {
		if (error._tag === "DictionaryCommitFailed") return error;
		if (error._tag === "DictionaryTransactionConflict")
			return new DictionaryCommitFailed({
				cause: error,
				message: `The dictionary kept changing while ${what} (${error.reason})`,
			});
		return failed(error.message)(error);
	};

const emojiDescriptionsOf = (
	readings: readonly { reading: Dumling.Reading<"de"> }[],
) =>
	readings.flatMap(({ reading }) =>
		"emojiDescription" in reading ? [reading.emojiDescription] : [],
	);

/**
 * The Emoji Descriptions of the stored Readings whose Valency Frame has an
 * Optional Reflexive Slot, as `(sich) ausruhen` has: `resolve.reading`
 * offers them to a reflexive click beside the 🪞 Readings (texteater ADR
 * 0052).
 */
export const optionallyReflexiveOf = (
	readings: readonly {
		reading: Dumling.Reading<"de">;
		knowledge?: { readonly valency?: Dumrel.ValencyFrame };
	}[],
) =>
	emojiDescriptionsOf(
		readings.filter(({ knowledge }) =>
			(knowledge?.valency ?? []).some(
				(slot) =>
					slot.status === "Optional" &&
					slot.complements.some(({ kind }) => kind === "Reflexive"),
			),
		),
	);

/**
 * The occurrence's Attestation Link, when its block can carry an ID: its
 * ref as the dictionary already holds it, if it holds it naming the
 * Scroll another way.
 */
function linkOf(
	view: DictionaryView,
	input: OccurrenceCommit,
): AttestationLink<"de"> | undefined {
	return input.attestationRef === undefined
		? undefined
		: {
				reading: input.reading,
				ref: storedRefFor(
					view,
					input.attestationRef,
					input.scrollAliases ?? [],
				),
				surfaceId: makeSurfaceId("de", input.surface),
			};
}

/**
 * Plans removing an occurrence (`removeOccurrence`) and what it leaves
 * behind: a Reading with no link, a Surface no link names, a Lemma with no
 * Reading, with the claims on them. Once the plan has landed, the store
 * re-evaluates the Shadows of the Lemmas it removed, as a commit of its own
 * from a slice loaded then (texteater#1257).
 */
export function planRemoval(
	view: DictionaryView,
	ref: string,
): Result.Result<Transaction<"Removed">, DictionaryCommitFailed> {
	const slice = view.loadOccurrenceSlice(
		planner.occurrenceSliceRequest({ ref }),
	);
	const outcome = planner.removeOccurrence(slice, { ref });
	if (outcome.status === "conflict")
		return Result.succeed(
			Transaction.replan(outcome.message ?? outcome.code),
		);
	if (outcome.status === "rejected")
		return Result.fail(
			new DictionaryCommitFailed({
				cause: outcome,
				message: outcome.message ?? outcome.code,
			}),
		);
	if (outcome.plan.changes.length === 0)
		return Result.succeed(Transaction.stop("Removed"));
	return Result.succeed(Transaction.commit(outcome.plan, "Removed"));
}

/**
 * What a ref recorded elsewhere asks: nothing when this Reading holds it
 * under another Surface; when another Reading does, removing it there
 * first, then recording it here from the view that leaves.
 */
function elsewhere(
	view: DictionaryView,
	input: OccurrenceCommit,
	ref: string,
	stored: readonly AttestationLink<"de">[],
): Planned {
	if (
		stored.length > 0 &&
		stored.every(
			(link) =>
				readingIdentityKey(link.reading) ===
				readingIdentityKey(input.reading),
		)
	)
		return Result.succeed(Transaction.stop(unchanged));
	return Result.map(planRemoval(view, ref), (removal) =>
		removal._tag === "Commit"
			? Transaction.commitAndReplan(removal.plan, MOVED)
			: Transaction.replan(
					removal._tag === "Replan" ? removal.reason : MOVED,
				),
	);
}

const loadContext = <I extends ReadingEntryContext<"de">["intent"]>(
	view: DictionaryView,
	load: Parameters<typeof planner.contextRequest>[0],
	intent: I,
): Result.Result<
	Extract<ReadingEntryContext<"de">, { intent: I }>,
	DictionaryCommitFailed
> =>
	Result.flatMap(
		Result.mapError(
			view.loadReadingEntryContext(planner.contextRequest(load)),
			failed("Could not read the dictionary"),
		),
		(context) =>
			context.intent === intent
				? Result.succeed(
						context as Extract<
							ReadingEntryContext<"de">,
							{ intent: I }
						>,
					)
				: Result.fail(
						new DictionaryCommitFailed({
							cause: context,
							message: "The dictionary answered another slice",
						}),
					),
	);

/** Plans a reused Reading's occurrence: its link and Surface, or the Surface alone. */
const planReuse = (view: DictionaryView, input: OccurrenceCommit): Planned =>
	Result.gen(function* () {
		const link = linkOf(view, input);
		let outcome: DumdictPlanOutcome<"de">;
		if (link === undefined) {
			const request = {
				ownedSurface: {
					note: emptySurfaceNote(),
					surface: input.surface,
				},
				reading: input.reading,
			};
			const context = yield* loadContext(
				view,
				{ intent: "ensureOwnedSurface", request },
				"ensureOwnedSurface",
			);
			outcome = planner.ensureOwnedSurface(context, request);
		} else {
			const request = { link, surface: input.surface };
			const context = yield* loadContext(
				view,
				{ intent: "recordOccurrence", request },
				"recordOccurrence",
			);
			outcome = planner.recordOccurrence(context, request);
			if (
				outcome.status === "rejected" &&
				outcome.code === "occurrenceAttestedElsewhere"
			)
				return yield* elsewhere(
					view,
					input,
					link.ref,
					context.attestationLinksWithRefs,
				);
		}
		if (outcome.status === "conflict")
			return Transaction.replan(outcome.message ?? outcome.code);
		if (outcome.status === "rejected") {
			if (outcome.code === "readingMissing")
				return Transaction.replan("The Reading vanished");
			return yield* Result.fail(
				new DictionaryCommitFailed({
					cause: outcome,
					message: outcome.message ?? outcome.code,
				}),
			);
		}
		if (outcome.plan.changes.length === 0)
			return Transaction.stop(unchanged);
		return Transaction.commit<OccurrenceCommitted>(outcome.plan, {
			_tag: "Committed",
			created: false,
		});
	});

const planNew = (view: DictionaryView, input: OccurrenceCommit): Planned =>
	Result.gen(function* () {
		const surfaceStored =
			view.surface(makeSurfaceId("de", input.surface)) !== undefined;
		const link = linkOf(view, input);
		const request = {
			draft: {
				note: {
					...emptyReadingNote(),
					attestationLinks: link === undefined ? [] : [link],
				},
				ownedSurfaces: surfaceStored
					? []
					: [{ note: emptySurfaceNote(), surface: input.surface }],
				reading: input.reading,
			},
		};
		const context = yield* loadContext(
			view,
			{ intent: "addNewNote", request },
			"addNewNote",
		);
		const outcome = planner.addNewNote(context, request);
		if (outcome.status === "conflict")
			return Transaction.replan(outcome.message ?? outcome.code);
		if (outcome.status === "rejected") {
			if (outcome.code === "occurrenceAttestedElsewhere" && link)
				return yield* elsewhere(
					view,
					input,
					link.ref,
					context.attestationLinksWithRefs,
				);
			if (
				outcome.code === "readingAlreadyExists" ||
				outcome.code === "ownedSurfaceAlreadyExists"
			)
				return Transaction.replan(outcome.message ?? outcome.code);
			return yield* Result.fail(
				new DictionaryCommitFailed({
					cause: outcome,
					message: outcome.message ?? outcome.code,
				}),
			);
		}
		return Transaction.commit<OccurrenceCommitted>(outcome.plan, {
			_tag: "Committed",
			created: true,
		});
	});

/**
 * Plans against the store's view. A Reading stored by now is reused
 * whatever the judge decided; a New the judge decided without seeing every
 * stored Reading of its Lemma is stale, and stops the transaction.
 */
function planOccurrence(
	view: DictionaryView,
	input: OccurrenceCommit,
): Planned {
	// A reused Reading deleted meanwhile is created again.
	if (view.readingLocation(input.reading)) return planReuse(view, input);
	if (input.decision === "New" && input.seen !== undefined) {
		const { lemma } = input.reading;
		const keyOf = (emojiDescription: string) =>
			readingIdentityKey({
				emojiDescription,
				lemma,
				unitKind: "Reading",
			} as Dumling.Reading<"de">);
		const judged = new Set(input.seen.map(keyOf));
		const readings = view.lemmaNote(lemma)?.readings ?? [];
		if (
			readings.some(
				({ reading }) => !judged.has(readingIdentityKey(reading)),
			)
		)
			return Result.succeed(
				Transaction.stop<OccurrenceCommitted>({
					_tag: "Stale",
					candidates: emojiDescriptionsOf(readings),
					optionallyReflexive: optionallyReflexiveOf(readings),
				}),
			);
	}
	return planNew(view, input);
}

/**
 * Commits one occurrence as one transaction. A `Stale` answer wrote
 * nothing; its caller judges again, outside the store's lock.
 */
export const commitOccurrence = Effect.fn("classify.commitOccurrence")(
	function* (
		store: Pick<ResolutionStore, "transact">,
		input: OccurrenceCommit,
	): Effect.fn.Return<OccurrenceCommitted, DictionaryCommitFailed> {
		return yield* store
			.transact((view) => planOccurrence(view, input), {
				maxAttempts: MAX_COMMIT_ATTEMPTS,
			})
			.pipe(Effect.mapError(commitFailure("this occurrence committed")));
	},
);
