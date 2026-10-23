/**
 * A Librarian made in a scope of its own, as the lifecycle makes each one,
 * for tests that start and close it by hand. `closeLibrarian` closes that
 * scope, which unsubscribes it, and fails as its unsubscribe failed.
 */
import { Effect, Exit, Option, Scope } from "effect";
import {
	Librarian,
	type LibrarianOptions,
	type LibrarianUnsubscribeFailure,
	type LibrarianVam,
} from "../../src/commanders/librarian/librarian";

const scopes = new WeakMap<Librarian, Scope.Closeable>();

/** A new Librarian over `vam`, not yet started, in a scope of its own. */
export function makeLibrarian(
	vam: LibrarianVam,
	options: LibrarianOptions,
): Librarian {
	const scope = Scope.makeUnsafe();
	const librarian = Effect.runSync(
		Librarian.make(vam, options).pipe(Scope.provide(scope)),
	);
	scopes.set(librarian, scope);
	return librarian;
}

/** Closes the Librarian's scope, as a restart or the unload does. */
export function closeLibrarian(
	librarian: Librarian,
): Effect.Effect<void, LibrarianUnsubscribeFailure> {
	const scope = scopes.get(librarian);
	if (!scope)
		return Effect.die(new Error("Not a Librarian made by makeLibrarian"));
	return Scope.close(scope, Exit.void).pipe(
		Effect.andThen(librarian.unsubscribed),
		Effect.flatMap(
			Option.match({ onNone: () => Effect.void, onSome: (exit) => exit }),
		),
	);
}
