/**
 * What each detector is given: the host, the handler that takes an event,
 * and the run of a handled event on the host's runtime.
 */
import { Effect, Exit } from "effect";
import type {
	UserEventDecisionMap,
	UserEventFailure,
	UserEventHandler,
	UserEventKind,
	UserEventPayloadMap,
	UserEventResult,
	UserEventsHost,
} from "../contracts";

export type EventDispatch = {
	readonly host: UserEventsHost;
	/**
	 * The handler of `kind` that takes `payload`, if one does. Plain and
	 * synchronous, so a detector can prevent the event's default by it.
	 */
	readonly decide: <K extends UserEventKind>(
		kind: K,
		payload: UserEventDecisionMap[K],
	) => UserEventHandler<K> | undefined;
	/**
	 * Runs a handled event on the host's runtime: reads its `payload`,
	 * hands it to `handler`, applies the result with `apply`, then runs the
	 * handler's `afterwards`, all in one fiber. It starts at once, so a
	 * program that never waits is done when this returns. `afterwards`
	 * runs once the result was applied or failed to be; a failure of
	 * either is the program's.
	 */
	readonly run: <K extends UserEventKind>(
		kind: K,
		handler: UserEventHandler<K>,
		payload: Effect.Effect<UserEventPayloadMap[K], UserEventFailure>,
		apply?: (
			result: UserEventResult<K>,
		) => Effect.Effect<void, UserEventFailure>,
	) => void;
};

/** The program `EventDispatch.run` forks. */
export const handled = <K extends UserEventKind>(
	handler: UserEventHandler<K>,
	payload: Effect.Effect<UserEventPayloadMap[K], UserEventFailure>,
	apply?: (
		result: UserEventResult<K>,
	) => Effect.Effect<void, UserEventFailure>,
): Effect.Effect<void, UserEventFailure> =>
	Effect.gen(function* () {
		const read = yield* payload;
		const result = yield* handler.handle(read);
		// The handler's own follow-up does not depend on the layer's step,
		// such as Classify's reopen on a link Obsidian failed to open.
		const applied = apply ? yield* Effect.exit(apply(result)) : Exit.void;
		if (handler.afterwards) yield* handler.afterwards(read);
		yield* applied;
	});
