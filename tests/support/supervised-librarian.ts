/**
 * A fake Librarian for the lifecycle supervisor, made in the scope the
 * supervisor gives it, as `Librarian.make` is: closing that scope runs the
 * fake's `unsubscribe`, and `unsubscribed` answers how it ended.
 */
import { Effect, type Exit, Option, type Scope } from "effect";
import type { LibrarianUnsubscribeFailure } from "../../src/commanders/librarian/librarian";
import type { SupervisedLibrarian } from "../../src/lifecycle/lifecycle-supervisor";

/** A fake with its own `unsubscribe`, which its scope's close runs. */
export type ScopedFake = SupervisedLibrarian & {
	readonly unsubscribe: () => Effect.Effect<
		void,
		LibrarianUnsubscribeFailure
	>;
};

export function inItsScope<L extends ScopedFake>(
	fake: Omit<L, "unsubscribed">,
): Effect.Effect<L, never, Scope.Scope> {
	return Effect.gen(function* () {
		let unsubscribed: Option.Option<
			Exit.Exit<void, LibrarianUnsubscribeFailure>
		> = Option.none();
		const librarian = Object.assign(fake, {
			unsubscribed: Effect.sync(() => unsubscribed),
		}) as unknown as L;
		// Read as the scope closes, so a test may swap `unsubscribe` first.
		yield* Effect.addFinalizer(() =>
			Effect.suspend(() => librarian.unsubscribe()).pipe(
				Effect.exit,
				Effect.map((exit) => {
					unsubscribed = Option.some(exit);
				}),
			),
		);
		return librarian;
	});
}
