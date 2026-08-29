import { Effect } from "effect";
import type { Result, ResultAsync } from "neverthrow";

export function resultToEffect<A, E>(
	result: Result<A, E>,
): Effect.Effect<A, E> {
	return result.isErr()
		? Effect.fail(result.error)
		: Effect.succeed(result.value);
}

export function resultAsyncToEffect<A, E>(
	result: ResultAsync<A, E>,
): Effect.Effect<A, E> {
	return Effect.promise(() => result).pipe(Effect.flatMap(resultToEffect));
}
