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
 * The store commits all-or-nothing against the revision a plan was built
 * from, so a plan is rebuilt from fresh slices whenever another write wins
 * the race, a bounded number of times. A New whose judge never saw a
 * Reading the Lemma has gained since is refused before anything is
 * written, and its caller judges again (ADR 0031).
 */
import type { DictionaryCommitError } from "@textfresser/dictionary";
import type { AttestationLink, DumdictPlan } from "dumdict";
import {
	createDumdictPlanner,
	type DumdictPlanOutcome,
	makeSurfaceId,
	type ReadingEntryContext,
} from "dumdict/planning";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { Effect } from "effect";
import { exclusive } from "./exclusive";
import {
	DictionaryCommitFailed,
	type ResolutionStore,
} from "./knowledge-types";

/** Plans rebuilt after a lost race before the occurrence gives up. */
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
	  };

type Planned =
	| { readonly _tag: "Stale"; readonly candidates: readonly string[] }
	| { readonly _tag: "Unchanged" }
	/** The ref is recorded under another Reading: remove it there first. */
	| { readonly _tag: "Move"; readonly ref: string }
	| { readonly _tag: "Retry"; readonly message: string }
	| {
			readonly _tag: "Plan";
			readonly created: boolean;
			readonly plan: DumdictPlan<"de">;
	  };

const failed = (message: string) => (cause: unknown) =>
	new DictionaryCommitFailed({ cause, message });

const emojiDescriptionsOf = (
	readings: readonly { reading: Dumling.Reading<"de"> }[],
) =>
	readings.flatMap(({ reading }) =>
		"emojiDescription" in reading ? [reading.emojiDescription] : [],
	);

/** The occurrence's Attestation Link, when its block can carry an ID. */
function linkOf(input: OccurrenceCommit): AttestationLink<"de"> | undefined {
	return input.attestationRef === undefined
		? undefined
		: {
				reading: input.reading,
				ref: input.attestationRef,
				surfaceId: makeSurfaceId("de", input.surface),
			};
}

/**
 * What a ref recorded elsewhere asks: a move when another Reading holds it,
 * nothing when this Reading does under another Surface.
 */
const elsewhere = (
	input: OccurrenceCommit,
	ref: string,
	stored: readonly AttestationLink<"de">[],
): Planned =>
	stored.length > 0 &&
	stored.every(
		(link) =>
			readingIdentityKey(link.reading) ===
			readingIdentityKey(input.reading),
	)
		? { _tag: "Unchanged" }
		: { _tag: "Move", ref };

const loadContext = <I extends ReadingEntryContext<"de">["intent"]>(
	store: ResolutionStore,
	load: Parameters<typeof planner.contextRequest>[0],
	intent: I,
) =>
	store.loadReadingEntryContext(planner.contextRequest(load)).pipe(
		Effect.mapError(failed("Could not read the dictionary")),
		Effect.flatMap((context) =>
			context.intent === intent
				? Effect.succeed(
						context as Extract<
							ReadingEntryContext<"de">,
							{ intent: I }
						>,
					)
				: Effect.fail(
						new DictionaryCommitFailed({
							cause: context,
							message: "The dictionary answered another slice",
						}),
					),
		),
	);

/** Plans a reused Reading's occurrence: its link and Surface, or the Surface alone. */
const planReuse = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
) {
	const link = linkOf(input);
	let outcome: DumdictPlanOutcome<"de">;
	if (link === undefined) {
		const request = {
			ownedSurface: { note: emptySurfaceNote(), surface: input.surface },
			reading: input.reading,
		};
		const context = yield* loadContext(
			store,
			{ intent: "ensureOwnedSurface", request },
			"ensureOwnedSurface",
		);
		outcome = planner.ensureOwnedSurface(context, request);
	} else {
		const request = { link, surface: input.surface };
		const context = yield* loadContext(
			store,
			{ intent: "recordOccurrence", request },
			"recordOccurrence",
		);
		outcome = planner.recordOccurrence(context, request);
		if (
			outcome.status === "rejected" &&
			outcome.code === "occurrenceAttestedElsewhere"
		)
			return elsewhere(input, link.ref, context.attestationLinksWithRefs);
	}
	if (outcome.status === "conflict")
		return {
			_tag: "Retry",
			message: outcome.message ?? outcome.code,
		} satisfies Planned;
	if (outcome.status === "rejected")
		return outcome.code === "readingMissing"
			? ({
					_tag: "Retry",
					message: "The Reading vanished",
				} satisfies Planned)
			: yield* new DictionaryCommitFailed({
					cause: outcome,
					message: outcome.message ?? outcome.code,
				});
	if (outcome.plan.changes.length === 0)
		return { _tag: "Unchanged" } satisfies Planned;
	return {
		_tag: "Plan",
		created: false,
		plan: outcome.plan,
	} satisfies Planned;
});

const planNew = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
) {
	const surfaceStored =
		(yield* store.surface(makeSurfaceId("de", input.surface))) !==
		undefined;
	const link = linkOf(input);
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
		store,
		{ intent: "addNewNote", request },
		"addNewNote",
	);
	const outcome = planner.addNewNote(context, request);
	if (outcome.status === "conflict")
		return {
			_tag: "Retry",
			message: outcome.message ?? outcome.code,
		} satisfies Planned;
	if (outcome.status === "rejected") {
		if (outcome.code === "occurrenceAttestedElsewhere" && link)
			return elsewhere(input, link.ref, context.attestationLinksWithRefs);
		return outcome.code === "readingAlreadyExists" ||
			outcome.code === "ownedSurfaceAlreadyExists"
			? ({
					_tag: "Retry",
					message: outcome.message ?? outcome.code,
				} satisfies Planned)
			: yield* new DictionaryCommitFailed({
					cause: outcome,
					message: outcome.message ?? outcome.code,
				});
	}
	return {
		_tag: "Plan",
		created: true,
		plan: outcome.plan,
	} satisfies Planned;
});

/**
 * Removes an occurrence (`removeOccurrence`) and what it leaves behind: a
 * Reading with no link, a Surface no link names, a Lemma with no Reading,
 * with the claims on them. The store follows a removed Lemma with the
 * Shadow re-evaluation it asks for. A plan worked around a stored claim
 * whose target is gone (`danglingRelationClaim`) is logged.
 */
const removeOccurrence = Effect.fnUntraced(function* (
	store: ResolutionStore,
	ref: string,
): Effect.fn.Return<"Removed" | "Retry", DictionaryCommitFailed> {
	const slice = yield* store.loadOccurrenceSlice(
		planner.occurrenceSliceRequest({ ref }),
	);
	const outcome = planner.removeOccurrence(slice, { ref });
	if (outcome.status === "conflict") return "Retry";
	if (outcome.status === "rejected")
		return yield* new DictionaryCommitFailed({
			cause: outcome,
			message: outcome.message ?? outcome.code,
		});
	if ((outcome.issues?.length ?? 0) > 0)
		yield* Effect.logWarning(
			"Removing an occurrence worked around stored claims",
			outcome.issues,
		);
	if (outcome.plan.changes.length === 0) return "Removed";
	const result = yield* store
		.commitChanges(outcome.plan)
		.pipe(
			Effect.catch((error) =>
				isRetryable(error)
					? Effect.succeed({ status: "conflict" as const })
					: Effect.fail(failed(error.message)(error)),
			),
		);
	return result.status === "committed" ? "Removed" : "Retry";
});

/**
 * Plans against the store as it is now. A Reading stored by now is reused
 * whatever the judge decided; a New the judge decided without seeing every
 * stored Reading of its Lemma is stale.
 */
const planOccurrence = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
): Effect.fn.Return<Planned, DictionaryCommitFailed> {
	const stored = yield* store.readingLocation(input.reading);
	// A reused Reading deleted meanwhile is created again.
	if (stored) return yield* planReuse(store, input);
	if (input.decision === "New" && input.seen !== undefined) {
		const { lemma } = input.reading;
		const note = yield* store.lemmaNote(lemma);
		const keyOf = (emojiDescription: string) =>
			readingIdentityKey({
				emojiDescription,
				lemma,
				unitKind: "Reading",
			} as Dumling.Reading<"de">);
		const judged = new Set(input.seen.map(keyOf));
		const readings = note?.readings ?? [];
		if (
			readings.some(
				({ reading }) => !judged.has(readingIdentityKey(reading)),
			)
		)
			return { _tag: "Stale", candidates: emojiDescriptionsOf(readings) };
	}
	return yield* planNew(store, input);
});

const isRetryable = (error: DictionaryCommitError) =>
	error._tag === "DictionaryWriteError";

export const commitOccurrence = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
): Effect.fn.Return<OccurrenceCommitted, DictionaryCommitFailed> {
	let last = "";
	const serialized = exclusive(store);
	for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt++) {
		const outcome = yield* serialized(
			Effect.gen(function* () {
				const planned = yield* planOccurrence(store, input);
				if (planned._tag === "Stale") return planned;
				if (planned._tag === "Unchanged")
					return { _tag: "Committed", created: false } as const;
				if (planned._tag === "Move") {
					yield* removeOccurrence(store, planned.ref);
					return {
						_tag: "Retry",
						message: "The occurrence moved from another Reading",
					} as const;
				}
				if (planned._tag === "Retry")
					return { _tag: "Retry", message: planned.message } as const;
				const result = yield* store.commitChanges(planned.plan).pipe(
					Effect.catch((error) =>
						isRetryable(error)
							? Effect.succeed({
									code: "revisionConflict" as const,
									message: error.message,
									status: "conflict" as const,
								})
							: Effect.fail(failed(error.message)(error)),
					),
				);
				return result.status === "committed"
					? ({ _tag: "Committed", created: planned.created } as const)
					: ({
							_tag: "Retry",
							message: result.message ?? result.code,
						} as const);
			}),
		);
		if (outcome._tag !== "Retry") return outcome;
		last = outcome.message;
	}
	return yield* new DictionaryCommitFailed({
		cause: last,
		message: `The dictionary kept changing while this occurrence committed (${last})`,
	});
});
