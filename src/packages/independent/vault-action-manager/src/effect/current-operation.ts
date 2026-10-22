import { Context } from "effect";
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
