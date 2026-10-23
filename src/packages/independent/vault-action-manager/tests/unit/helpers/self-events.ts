import { Effect } from "effect";
import type { Attribution } from "../../../src/impl/event-processing/callback-sequence";
import type { VamOperation } from "../../../src/types/event-origin";

/** The batch tests register Self Events under. */
export const TEST_OPERATION: VamOperation = {
	caller: "test",
	operationId: "test#1",
};

/** Whether the tracker attributed the callback to a Dispatch Batch. */
export const selfOf = <E, R>(
	attribution: Effect.Effect<Attribution, E, R>,
): Effect.Effect<boolean, E, R> =>
	Effect.map(attribution, ({ origin }) => origin.kind === "Vam");
