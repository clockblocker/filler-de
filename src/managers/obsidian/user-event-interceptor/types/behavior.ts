/**
 * Behavior types for the behavior chain pattern.
 *
 * Behaviors transform payloads in a chain, with each behavior deciding:
 * - proceedWithDefault: Pass through unchanged
 * - continue: Transform and pass to next behavior
 * - skip: Stop chain, prevent default
 * - replace: Stop chain, run custom action
 */

import type { App } from "obsidian";
import type { VaultActionManager } from "../../vault-action-manager";
import type { AnyPayload } from "./payload-base";
import type { TransformResult } from "./transform-kind";

/**
 * Context available to behaviors during transformation.
 */
export type BehaviorContext<P extends AnyPayload> = {
	/** The payload data to transform */
	data: P;
	/** Obsidian App instance */
	app: App;
	/** Vault action manager for file operations */
	vaultActionManager: VaultActionManager;
};

/**
 * Registration for a behavior in the chain.
 *
 * Behaviors are sorted by priority (lower = earlier).
 * isApplicable runs SYNC before preventDefault to avoid unnecessary blocking.
 */
export type BehaviorRegistration<P extends AnyPayload> = {
	/** Unique identifier for the behavior */
	id: string;
	/** Priority (1-50 core, 50-100 plugins). Lower runs first. */
	priority: number;
	/** SYNC check - returns true if this behavior should handle the payload */
	isApplicable: (payload: P) => boolean;
	/** Transform the payload. May be async. */
	transform: (
		ctx: BehaviorContext<P>,
	) => TransformResult<P> | Promise<TransformResult<P>>;
};

/**
 * Type helper for creating typed behavior registrations.
 */
export function defineBehavior<P extends AnyPayload>(
	registration: BehaviorRegistration<P>,
): BehaviorRegistration<P> {
	return registration;
}
