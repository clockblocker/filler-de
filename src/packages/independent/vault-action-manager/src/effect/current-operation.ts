import { Context, Effect } from "effect";
import type { VamOperation } from "../types/event-origin";

/**
 * The Dispatch Batch an action runs in, so a write deep in a file helper
 * records its modify Self Event under that batch's origin. Outside a batch,
 * as in a helper's own tests, writes are VAM's without a caller.
 */
export const CurrentVamOperation = Context.Reference<VamOperation>(
	"@textfresser/vault-action-manager/CurrentVamOperation",
	{ defaultValue: () => ({ caller: "vam", operationId: "vam" }) },
);

/** What the running create or rename found at its target. */
export type TargetCheck = { taken: boolean | undefined };

/**
 * Where a create or a rename records whether its target was taken, as the
 * vault's file system compares names, by the collision check it makes
 * immediately before it writes or moves (#202). The dispatch worker gives
 * each action its own; outside a batch nothing is recorded.
 */
export const CurrentTargetCheck = Context.Reference<TargetCheck | undefined>(
	"@textfresser/vault-action-manager/CurrentTargetCheck",
	{ defaultValue: () => undefined },
);

/** Records the running action's collision check; see `CurrentTargetCheck`. */
export const recordTargetTaken = Effect.fnUntraced(function* (taken: boolean) {
	const check = yield* CurrentTargetCheck;
	if (check) check.taken = taken;
});
