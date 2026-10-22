import { Effect } from "effect";
import type {
	VamOperation,
	VaultEventOrigin,
} from "../../../src/types/event-origin";

/** The batch tests register Self Events under. */
export const TEST_OPERATION: VamOperation = {
	caller: "test",
	operationId: "test#1",
};

/** Whether the tracker attributed the callback to a Dispatch Batch. */
export const selfOf = <E, R>(
	origin: Effect.Effect<VaultEventOrigin, E, R>,
): Effect.Effect<boolean, E, R> =>
	Effect.map(origin, ({ kind }) => kind === "Vam");
