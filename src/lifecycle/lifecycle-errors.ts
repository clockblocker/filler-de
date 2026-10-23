/**
 * What the lifecycle supervisor's commands fail with. Each wraps the
 * failure it stands for in `cause`, as the whole `Cause`: a defect or a
 * second failure next to the first is kept, and `formatCause` prints them.
 */
import { type Cause, Data } from "effect";
import type { LibrarianStop } from "../commanders/librarian/runtime/librarian-stop";
import { causeMessages } from "../utils/causes";
import type { LibrarianStartReason } from "./lifecycle-notices";

/**
 * A failure of a part the launch wires and the supervisor runs without
 * knowing it, such as a service it owns: any tagged error.
 */
export type TaggedFailure = Cause.YieldableError & { readonly _tag: string };

/** A command reached the supervisor after the plugin began to unload. */
export class LifecycleStoppedError extends Data.TaggedError(
	"LifecycleStoppedError",
) {
	override get message(): string {
		return "the plugin has unloaded";
	}
}

/**
 * The Librarian did not start for `reason`. `cause` holds its typed stop,
 * or what it threw.
 */
export class LibrarianStartFailed extends Data.TaggedError(
	"LibrarianStartFailed",
)<{
	readonly cause: Cause.Cause<LibrarianStop>;
	readonly reason: LibrarianStartReason;
}> {
	override get message(): string {
		return `the Librarian did not start (${this.reason})`;
	}
}

/** The launch could not build the plugin's services. */
export class BootFailed extends Data.TaggedError("BootFailed")<{
	readonly cause: Cause.Cause<TaggedFailure>;
}> {
	override get message(): string {
		return causeMessages(this.cause);
	}
}

/**
 * Releasing part of the plugin failed, such as `"unsubscribe the
 * Librarian"` or `"close the dictionary store"`.
 */
export class ReleaseFailed extends Data.TaggedError("ReleaseFailed")<{
	readonly cause: Cause.Cause<TaggedFailure>;
	readonly what: string;
}> {
	override get message(): string {
		return `could not ${this.what}: ${causeMessages(this.cause)}`;
	}
}
