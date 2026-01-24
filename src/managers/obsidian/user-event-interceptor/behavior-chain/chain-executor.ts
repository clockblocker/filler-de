/**
 * Chain executor for behavior chain pattern.
 *
 * Executes behaviors in priority order, passing transformed payloads through the chain.
 * Stops on skip or replace results.
 */

import { logger } from "../../../../utils/logger";
import type { BehaviorContext, BehaviorRegistration } from "../types/behavior";
import type { AnyPayload } from "../types/payload-base";
import type { ChainResult, TransformResult } from "../types/transform-kind";
import { TransformKind } from "../types/transform-kind";

/**
 * Execute the behavior chain for a payload.
 *
 * @param payload - Initial payload data
 * @param behaviors - Sorted list of behaviors (by priority)
 * @param baseCtx - Context without data (data is added per-behavior)
 * @returns Chain result indicating outcome
 */
export async function executeChain<P extends AnyPayload>(
	payload: P,
	behaviors: BehaviorRegistration<P>[],
	baseCtx: Omit<BehaviorContext<P>, "data">,
): Promise<ChainResult<P>> {
	let current = payload;

	for (const behavior of behaviors) {
		// Skip non-applicable behaviors (already filtered, but double-check)
		if (!behavior.isApplicable(current)) {
			continue;
		}

		const ctx: BehaviorContext<P> = { ...baseCtx, data: current };

		let result: TransformResult<P>;
		try {
			result = await behavior.transform(ctx);
		} catch (error) {
			logger.error(
				`[ChainExecutor] Behavior ${behavior.id} threw:`,
				error instanceof Error ? error.message : String(error),
			);
			// On error, skip this behavior and continue
			continue;
		}

		switch (result.kind) {
			case TransformKind.proceedWithDefault:
				// No change, continue to next behavior
				continue;

			case TransformKind.continue:
				// Update payload and continue to next behavior
				current = result.data;
				break;

			case TransformKind.skip:
				// Stop chain, signal skip
				return { outcome: "skipped", reason: result.reason };

			case TransformKind.replace:
				// Stop chain, signal replacement
				return { action: result.action, outcome: "replaced" };
		}
	}

	// Chain completed, return final payload
	return { data: current, outcome: "completed" };
}
