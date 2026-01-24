/**
 * Applicability check utilities for behavior chain.
 *
 * Checks if ANY registered behavior is applicable for a payload.
 * This runs SYNC before preventDefault to avoid blocking non-applicable events.
 */

import type { BehaviorRegistration } from "../types/behavior";
import type { AnyPayload } from "../types/payload-base";

/**
 * Check if any behavior in the list is applicable for the payload.
 * Runs synchronously to determine if we should preventDefault.
 */
export function anyApplicable<P extends AnyPayload>(
	payload: P,
	behaviors: BehaviorRegistration<P>[],
): boolean {
	return behaviors.some((b) => b.isApplicable(payload));
}

/**
 * Filter behaviors to only those applicable for the payload.
 */
export function filterApplicable<P extends AnyPayload>(
	payload: P,
	behaviors: BehaviorRegistration<P>[],
): BehaviorRegistration<P>[] {
	return behaviors.filter((b) => b.isApplicable(payload));
}
