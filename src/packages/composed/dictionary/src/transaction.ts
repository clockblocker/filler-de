/**
 * What one plan inside `transact` asks the store to do. A plan reads a
 * `DictionaryView` and answers one of these, synchronously, under the
 * store's lock; the store commits under the same lock.
 */
import type { DumdictPlan } from "dumdict";

export type Transaction<A> =
	| {
			/** Commit `plan`, then answer `value`. */
			readonly _tag: "Commit";
			readonly plan: DumdictPlan<"de">;
			readonly value: A;
	  }
	| {
			/**
			 * Commit `plan`, then plan again from the view it leaves, still
			 * under the lock, as a step of a larger change such as moving an
			 * occurrence. It counts as an attempt; `reason` says what is left
			 * when attempts run out.
			 */
			readonly _tag: "CommitAndReplan";
			readonly plan: DumdictPlan<"de">;
			readonly reason: string;
	  }
	| {
			/** Commit nothing and answer `value`, such as a Stale judgement. */
			readonly _tag: "Stop";
			readonly value: A;
	  }
	| {
			/**
			 * The view does not support a plan, such as a planner conflict:
			 * release the lock, let pending events land, and plan again.
			 */
			readonly _tag: "Replan";
			readonly reason: string;
	  };

export const Transaction = {
	commit: <A>(plan: DumdictPlan<"de">, value: A): Transaction<A> => ({
		_tag: "Commit",
		plan,
		value,
	}),
	commitAndReplan: (
		plan: DumdictPlan<"de">,
		reason: string,
	): Transaction<never> => ({
		_tag: "CommitAndReplan",
		plan,
		reason,
	}),
	replan: (reason: string): Transaction<never> => ({
		_tag: "Replan",
		reason,
	}),
	stop: <A>(value: A): Transaction<A> => ({ _tag: "Stop", value }),
};

export type TransactOptions = {
	/** Plans tried before the transaction gives up; 4 by default. */
	readonly maxAttempts?: number;
};
