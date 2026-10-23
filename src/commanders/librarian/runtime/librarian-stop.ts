/**
 * Why the Librarian stopped, as a typed failure: its start failed, or a
 * later reconciliation failed past recovery. `Librarian.init` fails with
 * it, and `onStopped` is told it.
 */
import type { VamScanError } from "@textfresser/vault-action-manager";
import { type Cause, Data } from "effect";
import type { LibrarianStopFailure } from "../librarian";
import type { LibrarianStopPhase } from "./describe-librarian-stop";

/**
 * The Librarian could not heal the library and is off. `message` is the
 * notice for the user; `cause` holds every reason that stopped it.
 */
export class LibrarianStopped extends Data.TaggedError("LibrarianStopped")<{
	readonly cause: Cause.Cause<LibrarianStopFailure>;
	readonly message: string;
	readonly phase: LibrarianStopPhase;
}> {}

/**
 * The vault has no Library folder: the scan could not list the root. Not a
 * failure to heal, so it is told more quietly than `LibrarianStopped`.
 */
export class LibraryRootMissing extends Data.TaggedError("LibraryRootMissing")<{
	readonly cause: VamScanError;
	readonly message: string;
}> {}

/** Why the Librarian stopped, with a message for the user. */
export type LibrarianStop = LibrarianStopped | LibraryRootMissing;
