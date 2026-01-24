/**
 * Behavior registry for managing behavior registrations.
 *
 * Behaviors are registered by payload kind and sorted by priority.
 * Lower priority values run first.
 */

import type { BehaviorRegistration } from "../types/behavior";
import type { AnyPayload, PayloadKind } from "../types/payload-base";

/**
 * Registry for behavior registrations.
 * Manages behaviors by payload kind with priority-based ordering.
 */
export class BehaviorRegistry {
	private readonly behaviors = new Map<
		PayloadKind,
		BehaviorRegistration<AnyPayload>[]
	>();

	/**
	 * Register a behavior for a payload kind.
	 * Returns unregister function.
	 */
	register<P extends AnyPayload>(
		kind: PayloadKind,
		behavior: BehaviorRegistration<P>,
	): () => void {
		const list = this.behaviors.get(kind) ?? [];

		// Add and sort by priority (lower first)
		list.push(behavior as BehaviorRegistration<AnyPayload>);
		list.sort((a, b) => a.priority - b.priority);

		this.behaviors.set(kind, list);

		// Return unregister function
		return () => {
			const current = this.behaviors.get(kind);
			if (current) {
				const idx = current.indexOf(
					behavior as BehaviorRegistration<AnyPayload>,
				);
				if (idx !== -1) {
					current.splice(idx, 1);
				}
			}
		};
	}

	/**
	 * Get all behaviors registered for a payload kind.
	 * Returns sorted by priority (lower first).
	 */
	getBehaviors<P extends AnyPayload>(
		kind: PayloadKind,
	): BehaviorRegistration<P>[] {
		return (this.behaviors.get(kind) ?? []) as BehaviorRegistration<P>[];
	}

	/**
	 * Clear all registered behaviors.
	 */
	clear(): void {
		this.behaviors.clear();
	}
}

/**
 * Global behavior registry instance.
 */
let globalRegistry: BehaviorRegistry | null = null;

/**
 * Get the global behavior registry.
 * Creates one if it doesn't exist.
 */
export function getBehaviorRegistry(): BehaviorRegistry {
	if (!globalRegistry) {
		globalRegistry = new BehaviorRegistry();
	}
	return globalRegistry;
}

/**
 * Reset the global behavior registry.
 * Useful for testing.
 */
export function resetBehaviorRegistry(): void {
	if (globalRegistry) {
		globalRegistry.clear();
	}
	globalRegistry = null;
}
