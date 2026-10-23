import { Cause, Effect } from "effect";
import { getErrorMessage } from "./get-error-message";

/**
 * The value of each failure and defect in `cause`, in order. Interruptions
 * are left out: they say who stopped a fiber, not why it failed.
 */
export function causeValues<E>(cause: Cause.Cause<E>): unknown[] {
	return cause.reasons.flatMap((reason) =>
		Cause.isFailReason(reason)
			? [reason.error]
			: Cause.isDieReason(reason)
				? [reason.defect]
				: [],
	);
}

/**
 * The message of each failure and defect in `cause`, joined by "; ". A
 * cause of one failure reads as that failure's message.
 */
export function causeMessages<E>(cause: Cause.Cause<E>): string {
	const values = causeValues(cause);
	return values.length > 0
		? values.map(getErrorMessage).join("; ")
		: "interrupted";
}

/** Only the interruptions in `cause`. */
export function interruptsOf<E>(cause: Cause.Cause<E>): Cause.Cause<never> {
	return Cause.fromReasons(cause.reasons.filter(Cause.isInterruptReason));
}

/**
 * Recovers from every cause but an interruption alone, which passes on.
 * Unlike `Effect.catch` or `Effect.mapError`, which see the first failure
 * only, `f` gets the whole cause: a defect or a second failure beside the
 * first is kept.
 */
export const catchWhole =
	<E, A2, E2, R2>(f: (cause: Cause.Cause<E>) => Effect.Effect<A2, E2, R2>) =>
	<A, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A | A2, E2, R | R2> =>
		Effect.catchCause(self, (cause) =>
			Cause.hasInterruptsOnly(cause)
				? Effect.failCause(interruptsOf(cause))
				: f(cause),
		);

/** Fails with `wrap` of the whole cause, as `catchWhole` sees it. */
export const failWhole = <E, E2>(wrap: (cause: Cause.Cause<E>) => E2) =>
	catchWhole<E, never, E2, never>((cause) => Effect.fail(wrap(cause)));
