/**
 * Publishes generated Knowledge into the dictionary (#64), as tf-demo's
 * `knowledgeGeneration.publish` does: dumdict parses the changes once at
 * this edge (`checkApplyGeneratedKnowledgeRequest`), `applyGeneratedKnowledge`
 * plans them against fresh slices, and the store commits the plan. A plan
 * larger than one commit takes (tf-demo's `MAX_PLANNED_CHANGES`), or a
 * relation slice larger than the store reads, is split by relation units
 * and sent in parts, the relations first and the rest of the Knowledge
 * with the last part.
 */

import {
	checkApplyGeneratedKnowledgeRequest,
	createDumdictPlanner,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { Effect } from "effect";
import { MAX_COMMIT_ATTEMPTS } from "./commit-occurrence";
import {
	DictionaryCommitFailed,
	type GermanKnowledgeChange,
	type GermanPendingRelation,
	type ResolutionStore,
} from "./knowledge-types";

/** The most changes one Knowledge commit plans, as tf-demo caps it. */
export const MAX_PLANNED_CHANGES = 50;

const planner = createDumdictPlanner("de");

export type KnowledgePublication = {
	readonly reading: Dumling.Reading<"de">;
	readonly changes: readonly GermanKnowledgeChange[];
	readonly pendingRelations: readonly GermanPendingRelation[];
};

type Attempt =
	| { readonly _tag: "Committed" }
	| { readonly _tag: "OverBudget" }
	| { readonly _tag: "Retry"; readonly message: string };

const isRelation = (change: GermanKnowledgeChange) =>
	change.aspect === "semanticRelations";

/** One publication's attempt: plan against fresh slices and commit. */
const attempt = Effect.fnUntraced(function* (
	store: ResolutionStore,
	publication: KnowledgePublication,
): Effect.fn.Return<Attempt, DictionaryCommitFailed> {
	const checked = yield* Effect.try({
		catch: (cause) =>
			new DictionaryCommitFailed({
				cause,
				message: "dumdict refused the generated Knowledge",
			}),
		try: () =>
			checkApplyGeneratedKnowledgeRequest("de", {
				changes: publication.changes,
				pendingRelations: publication.pendingRelations,
				reading: publication.reading,
			}),
	});
	if (checked.status !== "ok")
		return yield* new DictionaryCommitFailed({
			cause: checked,
			message: checked.message ?? checked.code,
		});
	const request = checked.request;
	const context = yield* store
		.loadReadingEntryContext(
			planner.contextRequest({
				intent: "applyGeneratedKnowledge",
				request,
			}),
		)
		.pipe(Effect.result);
	// A relation slice the store cannot hold in one read is over budget too.
	if (context._tag === "Failure") return { _tag: "OverBudget" };
	if (context.success.intent !== "applyGeneratedKnowledge")
		return yield* new DictionaryCommitFailed({
			cause: context.success,
			message: "The dictionary answered another slice",
		});
	const outcome = planner.applyGeneratedKnowledge(context.success, request);
	if (outcome.status === "conflict")
		return { _tag: "Retry", message: outcome.message ?? outcome.code };
	if (outcome.status === "rejected")
		return yield* new DictionaryCommitFailed({
			cause: outcome,
			message: outcome.message ?? outcome.code,
		});
	if (outcome.plan.changes.length > MAX_PLANNED_CHANGES)
		return { _tag: "OverBudget" };
	if (outcome.plan.changes.length === 0) return { _tag: "Committed" };
	const result = yield* store.commitChanges(outcome.plan).pipe(
		Effect.catch((error) =>
			error._tag === "DictionaryWriteError"
				? Effect.succeed({
						code: "revisionConflict" as const,
						message: error.message,
						status: "conflict" as const,
					})
				: Effect.fail(
						new DictionaryCommitFailed({
							cause: error,
							message: error.message,
						}),
					),
		),
	);
	return result.status === "committed"
		? { _tag: "Committed" }
		: { _tag: "Retry", message: result.message ?? result.code };
});

/** The smallest relation parts a publication splits into: one target or one pending relation each. */
function relationUnits(publication: KnowledgePublication) {
	const units: KnowledgePublication[] = [];
	for (const change of publication.changes.filter(isRelation)) {
		const targets =
			change.kind === "Contribute" && "value" in change
				? (change.value as readonly unknown[])
				: undefined;
		if (!targets || targets.length <= 1) {
			units.push({
				...publication,
				changes: [change],
				pendingRelations: [],
			});
			continue;
		}
		for (const target of targets)
			units.push({
				...publication,
				changes: [
					{ ...change, value: [target] } as GermanKnowledgeChange,
				],
				pendingRelations: [],
			});
	}
	for (const pending of publication.pendingRelations)
		units.push({
			...publication,
			changes: [],
			pendingRelations: [pending],
		});
	return units;
}

const merge = (
	reading: Dumling.Reading<"de">,
	parts: readonly KnowledgePublication[],
): KnowledgePublication => ({
	changes: parts.flatMap(({ changes }) => changes),
	pendingRelations: parts.flatMap(({ pendingRelations }) => pendingRelations),
	reading,
});

export type PublishOutcome = {
	/** Relation parts dropped because even alone they did not fit one commit. */
	readonly dropped: number;
};

/**
 * Publishes `publication`, splitting it when it does not fit one commit.
 * A part that keeps losing races fails the publication.
 */
export const publishKnowledge = Effect.fnUntraced(function* (
	store: ResolutionStore,
	publication: KnowledgePublication,
): Effect.fn.Return<PublishOutcome, DictionaryCommitFailed> {
	if (
		publication.changes.length === 0 &&
		publication.pendingRelations.length === 0
	)
		return { dropped: 0 };
	let last = "";
	for (let tries = 0; tries < MAX_COMMIT_ATTEMPTS; tries++) {
		const result = yield* attempt(store, publication);
		if (result._tag === "Committed") return { dropped: 0 };
		if (result._tag === "Retry") {
			last = result.message;
			continue;
		}
		const units = relationUnits(publication);
		const rest: KnowledgePublication = {
			changes: publication.changes.filter(
				(change) => !isRelation(change),
			),
			pendingRelations: [],
			reading: publication.reading,
		};
		if (units.length === 0)
			return yield* new DictionaryCommitFailed({
				cause: publication,
				message: "The generated Knowledge does not fit one commit",
			});
		if (units.length === 1 && rest.changes.length === 0)
			return { dropped: 1 };
		if (units.length === 1) {
			// Nothing left to split: drop the relation part, keep the rest.
			const restOutcome = yield* publishKnowledge(store, rest);
			return { dropped: units.length + restOutcome.dropped };
		}
		const half = Math.ceil(units.length / 2);
		const first = yield* publishKnowledge(
			store,
			merge(publication.reading, units.slice(0, half)),
		);
		const second = yield* publishKnowledge(
			store,
			merge(publication.reading, [...units.slice(half), rest]),
		);
		return { dropped: first.dropped + second.dropped };
	}
	return yield* new DictionaryCommitFailed({
		cause: last,
		message: `The dictionary kept changing while Knowledge was saved (${last})`,
	});
});
