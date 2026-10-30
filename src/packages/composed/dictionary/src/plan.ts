/**
 * dumdict's planner is synchronous and throws for a slice that breaks its
 * storage contract, such as a stored claim on a quarantined Lemma. Every
 * plan the store and its callers make goes through {@link planned}, so a
 * throw is a typed failure and never a defect.
 */
import type { DumdictPlanOutcome } from "dumdict/planning";
import { Result } from "effect";
import { DictionaryPlanError } from "./errors";

/** The planner's outcome, or the `DictionaryPlanError` it threw. */
export const planned = (
	plan: () => DumdictPlanOutcome<"de">,
): Result.Result<DumdictPlanOutcome<"de">, DictionaryPlanError> =>
	Result.try({
		catch: (cause) =>
			new DictionaryPlanError({
				cause,
				message: `dumdict could not plan from the stored notes: ${cause instanceof Error ? cause.message : String(cause)}`,
			}),
		try: plan,
	});
