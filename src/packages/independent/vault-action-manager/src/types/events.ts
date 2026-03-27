import type { VaultActionKind } from "./vault-action";

/**
 * Event payload for textfresser:actions-complete.
 * Fired after VaultActionManager finishes dispatching a batch.
 */
export type ActionsCompleteEvent = {
	/** Action kinds that were in the dispatched batch */
	kinds: VaultActionKind[];
	/** Whether all actions succeeded */
	success: boolean;
};
