/**
 * Commits one resolved occurrence to the dictionary (#64), as tf-demo's
 * `planAndCommitDictionary` does inside its transaction: a New Reading
 * becomes a new Reading Entry owning the attested Surface, and a reused
 * Reading gains the Surface if its Lemma does not own it yet. Either way
 * the Reading records the occurrence's Attestation Ref.
 *
 * The store commits all-or-nothing against the revision a plan was built
 * from, so a plan is rebuilt from fresh slices whenever another write wins
 * the race, a bounded number of times. A New whose judge never saw a
 * Reading the Lemma has gained since is refused before anything is
 * written, and its caller judges again (ADR 0031).
 */
import type { DictionaryCommitError } from "@textfresser/dictionary";
import type { DumdictPlan, PlannedChangeOp } from "dumdict";
import { createDumdictPlanner, makeSurfaceId } from "dumdict/planning";
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

const emptyNote = () => ({
	attestations: [] as string[],
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

const planReuse = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
) {
	const request = {
		ownedSurface: { note: emptyNote(), surface: input.surface },
		reading: input.reading,
	};
	const context = yield* store
		.loadReadingEntryContext(
			planner.contextRequest({ intent: "ensureOwnedSurface", request }),
		)
		.pipe(Effect.mapError(failed("Could not read the dictionary")));
	if (context.intent !== "ensureOwnedSurface")
		return yield* new DictionaryCommitFailed({
			cause: context,
			message: "The dictionary answered another slice",
		});
	const outcome = planner.ensureOwnedSurface(context, request);
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
	const attestations = context.existingReading?.attestations ?? [];
	const ref = input.attestationRef;
	const attest: PlannedChangeOp<"de">[] =
		ref === undefined || attestations.includes(ref)
			? []
			: [
					{
						ops: [{ kind: "addAttestation", value: ref }],
						preconditions: [
							{
								kind: "revisionMatches",
								revision: context.revision,
							},
							{ kind: "readingExists", reading: input.reading },
							{
								kind: "readingAttestationMissing",
								reading: input.reading,
								value: ref,
							},
						],
						reading: input.reading,
						type: "patchReading",
					},
				];
	if (outcome.plan.changes.length === 0 && attest.length === 0)
		return { _tag: "Unchanged" } satisfies Planned;
	const plan: DumdictPlan<"de"> = {
		baseRevision: outcome.plan.baseRevision,
		changes: [...outcome.plan.changes, ...attest],
	};
	return { _tag: "Plan", created: false, plan } satisfies Planned;
});

const planNew = Effect.fnUntraced(function* (
	store: ResolutionStore,
	input: OccurrenceCommit,
) {
	const surfaceStored =
		(yield* store.surface(makeSurfaceId("de", input.surface))) !==
		undefined;
	const request = {
		draft: {
			note: {
				...emptyNote(),
				attestations:
					input.attestationRef === undefined
						? []
						: [input.attestationRef],
			},
			ownedSurfaces: surfaceStored
				? []
				: [{ note: emptyNote(), surface: input.surface }],
			reading: input.reading,
		},
	};
	const context = yield* store
		.loadReadingEntryContext(
			planner.contextRequest({ intent: "addNewNote", request }),
		)
		.pipe(Effect.mapError(failed("Could not read the dictionary")));
	if (context.intent !== "addNewNote")
		return yield* new DictionaryCommitFailed({
			cause: context,
			message: "The dictionary answered another slice",
		});
	const outcome = planner.addNewNote(context, request);
	if (outcome.status === "conflict")
		return {
			_tag: "Retry",
			message: outcome.message ?? outcome.code,
		} satisfies Planned;
	if (outcome.status === "rejected")
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
	return {
		_tag: "Plan",
		created: true,
		plan: outcome.plan,
	} satisfies Planned;
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
