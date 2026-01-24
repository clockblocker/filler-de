/**
 * Handler types for user event processing.
 *
 * One handler per event type. Handler decides: handle or passthrough.
 *
 * Flow:
 * 1. Detector captures DOM event
 * 2. Codec encodes to Payload
 * 3. handler.doesApply(payload)? (SYNC - before preventDefault)
 *    - no  → native behavior proceeds
 *    - yes → preventDefault(), await handler.handle()
 * 4. Apply HandleResult
 */

import type { App } from "obsidian";
import z from "zod";
import type { VaultActionManager } from "../../vault-action-manager";
import type { AnyPayload } from "./payload-base";

export const HandlerOutcomeEnum = z.enum([
	"Handled",
	"Passthrough",
	"Modified",
]);
export type HandlerOutcome = z.infer<typeof HandlerOutcomeEnum>;
export const HandlerOutcome = HandlerOutcomeEnum.enum;

/**
 * Context available to handlers during execution.
 */
export type HandlerContext = {
	/** Obsidian App instance */
	app: App;
	/** Vault action manager for file operations */
	vaultActionManager: VaultActionManager;
};

/**
 * Result of handler execution.
 * Discriminated by `outcome` field.
 */
export type HandleResult<P extends AnyPayload = AnyPayload> =
	| { outcome: typeof HandlerOutcome.Handled } // event fully consumed, no further action
	| { outcome: typeof HandlerOutcome.Passthrough } // let native behavior happen
	| { outcome: typeof HandlerOutcome.Modified; data: P }; // modify payload data (e.g., clipboard text)

/**
 * Event handler for a specific payload type.
 *
 * - doesApply: SYNC check before preventDefault. Return true to intercept.
 * - handle: Transform payload. Called after preventDefault if doesApply returns true.
 */
export type EventHandler<P extends AnyPayload> = {
	/** SYNC check - returns true if this handler should intercept the event */
	doesApply: (payload: P) => boolean;
	/** Handle the event. May be async. */
	handle: (
		payload: P,
		ctx: HandlerContext,
	) => HandleResult<P> | Promise<HandleResult<P>>;
};

/**
 * Teardown function returned by handler registration.
 */
export type HandlerTeardown = () => void;
