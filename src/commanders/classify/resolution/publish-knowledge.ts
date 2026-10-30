/**
 * Publishes generated Knowledge into the dictionary (#64), as tf-demo's
 * `knowledgeGeneration.publish` does: dumdict parses the changes once at
 * this edge (`checkApplyGeneratedKnowledgeRequest`), and one store
 * transaction plans them with `applyGeneratedKnowledge` from the store's
 * view and commits the plan under the store's lock. A plan
 * larger than one commit takes (tf-demo's `MAX_PLANNED_CHANGES`), or a
 * relation slice larger than the store reads, is split by relation units
 * and sent in parts, the relations first and the rest of the Knowledge
 * with the last part.
 */

import { pointsBack, Transaction } from "@textfresser/dictionary";
import {
	checkApplyGeneratedKnowledgeRequest,
	createDumdictPlanner,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Effect, Result } from "effect";
import {
	commitFailure,
	MAX_COMMIT_ATTEMPTS,
	planOf,
} from "./commit-occurrence";
import { sourceTargetOf, storedBasesOf } from "./knowledge-breakdown";
import {
	DictionaryCommitFailed,
	type GermanKnowledgeChange,
	type GermanPendingRelation,
	type ResolutionStore,
} from "./knowledge-types";

/** The most changes one Knowledge commit plans, as tf-demo caps it. */
const MAX_PLANNED_CHANGES = 50;

const planner = createDumdictPlanner("de");

export type KnowledgePublication = {
	readonly reading: Dumling.Reading<"de">;
	readonly changes: readonly GermanKnowledgeChange[];
	readonly pendingRelations: readonly GermanPendingRelation[];
	/** The Lemma Paradigm's changes (texteater#1230), applied with the Knowledge. */
	readonly paradigmChanges?: readonly Dumrel.ParadigmChange[];
};

type Published =
	| {
			readonly _tag: "Committed";
			/** A Source dropped for pointing back, by its base's Canonical Form. */
			readonly droppedSource?: string;
	  }
	| { readonly _tag: "OverBudget"; readonly reason: string };

const isRelation = (change: GermanKnowledgeChange) =>
	change.aspect === "semanticRelations";

/**
 * One publication as one store transaction: dumdict checks it once, then
 * it is planned from the store's view and committed under its lock.
 */
const publishOnce = Effect.fnUntraced(function* (
	store: Pick<ResolutionStore, "transact">,
	publication: KnowledgePublication,
): Effect.fn.Return<Published, DictionaryCommitFailed> {
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
				...(publication.paradigmChanges === undefined ||
				publication.paradigmChanges.length === 0
					? {}
					: { paradigmChanges: publication.paradigmChanges }),
			}),
	});
	if (checked.status !== "ok")
		return yield* new DictionaryCommitFailed({
			cause: checked,
			message: checked.message ?? checked.code,
		});
	const checkedRequest = checked.request;
	const published = yield* store
		.transact(
			(
				view,
			): Result.Result<
				Transaction<Published>,
				DictionaryCommitFailed
			> => {
				// Another run may have stored the other direction since this
				// one checked (texteater #1279): the first stored one wins.
				const owner = checkedRequest.reading.lemma;
				const backPointing = checkedRequest.changes.find((change) => {
					const target = sourceTargetOf(change);
					return (
						target !== undefined &&
						pointsBack(owner, target, storedBasesOf(view, target))
					);
				});
				const droppedSource =
					backPointing === undefined
						? undefined
						: sourceTargetOf(backPointing)?.canonicalForm;
				const request =
					backPointing === undefined
						? checkedRequest
						: {
								...checkedRequest,
								changes: checkedRequest.changes.filter(
									(change) => change !== backPointing,
								),
							};
				const committed: Published = {
					_tag: "Committed",
					...(droppedSource === undefined ? {} : { droppedSource }),
				};
				const context = view.loadReadingEntryContext(
					planner.contextRequest({
						intent: "applyGeneratedKnowledge",
						request,
					}),
				);
				// A relation slice the store cannot hold in one read is over budget too.
				if (Result.isFailure(context))
					return Result.succeed(
						Transaction.stop<Published>({
							_tag: "OverBudget",
							reason: context.failure.message,
						}),
					);
				if (context.success.intent !== "applyGeneratedKnowledge")
					return Result.fail(
						new DictionaryCommitFailed({
							cause: context.success,
							message: "The dictionary answered another slice",
						}),
					);
				const slice = context.success;
				const attempt = planOf(() =>
					planner.applyGeneratedKnowledge(slice, request),
				);
				if (Result.isFailure(attempt))
					return Result.fail(attempt.failure);
				const outcome = attempt.success;
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
				if (outcome.plan.changes.length > MAX_PLANNED_CHANGES)
					return Result.succeed(
						Transaction.stop<Published>({
							_tag: "OverBudget",
							reason: `${outcome.plan.changes.length} planned changes`,
						}),
					);
				if (outcome.plan.changes.length === 0)
					return Result.succeed(Transaction.stop(committed));
				return Result.succeed(
					Transaction.commit(outcome.plan, committed),
				);
			},
			{ maxAttempts: MAX_COMMIT_ATTEMPTS },
		)
		.pipe(Effect.mapError(commitFailure("Knowledge was saved")));
	if (published._tag === "Committed" && published.droppedSource !== undefined)
		yield* Effect.logWarning("BackPointingSourceRejected").pipe(
			Effect.annotateLogs({
				base: published.droppedSource,
				owner: publication.reading.lemma.canonicalForm,
			}),
		);
	return published;
});

/**
 * The smallest relation parts a publication splits into: one target or one
 * pending relation each. Paradigm Changes stay with the rest.
 */
function relationUnits({
	paradigmChanges: _paradigm,
	...publication
}: KnowledgePublication) {
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
): KnowledgePublication => {
	const paradigmChanges = parts.flatMap(
		({ paradigmChanges: changes }) => changes ?? [],
	);
	return {
		changes: parts.flatMap(({ changes }) => changes),
		pendingRelations: parts.flatMap(
			({ pendingRelations }) => pendingRelations,
		),
		reading,
		...(paradigmChanges.length === 0 ? {} : { paradigmChanges }),
	};
};

export type PublishOutcome = {
	/** Relation parts dropped because even alone they did not fit one commit. */
	readonly dropped: number;
};

/**
 * Publishes `publication`, splitting it when it does not fit one commit.
 * A part that keeps losing races fails the publication.
 */
export const publishKnowledge = Effect.fn("classify.publishKnowledge")(
	function* (
		store: Pick<ResolutionStore, "transact">,
		publication: KnowledgePublication,
	): Effect.fn.Return<PublishOutcome, DictionaryCommitFailed> {
		if (
			publication.changes.length === 0 &&
			publication.pendingRelations.length === 0 &&
			(publication.paradigmChanges?.length ?? 0) === 0
		)
			return { dropped: 0 };
		const result = yield* publishOnce(store, publication);
		if (result._tag === "Committed") return { dropped: 0 };
		const units = relationUnits(publication);
		const rest: KnowledgePublication = {
			changes: publication.changes.filter(
				(change) => !isRelation(change),
			),
			pendingRelations: [],
			reading: publication.reading,
			...(publication.paradigmChanges === undefined
				? {}
				: { paradigmChanges: publication.paradigmChanges }),
		};
		if (units.length === 0)
			return yield* new DictionaryCommitFailed({
				cause: publication,
				message: `The generated Knowledge does not fit one commit: ${result.reason}`,
			});
		if (
			units.length === 1 &&
			rest.changes.length === 0 &&
			(rest.paradigmChanges?.length ?? 0) === 0
		)
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
	},
);
