import { Effect, Exit, Scope } from "effect";

/**
 * Runs `effect` in a scope of its own, on Effect's default runtime, for
 * tests that make a scoped service and hold it outside an Effect. `close`
 * closes that scope, as the plugin's unload closes a Layer's.
 */
export async function inScope<A, E>(
	effect: Effect.Effect<A, E, Scope.Scope>,
): Promise<{ readonly value: A; readonly close: () => Promise<void> }> {
	const scope = Scope.makeUnsafe();
	const value = await Effect.runPromise(Scope.provide(scope)(effect));
	return {
		close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
		value,
	};
}
