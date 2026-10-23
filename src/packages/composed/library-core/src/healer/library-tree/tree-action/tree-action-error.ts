import { Data } from "effect";

/**
 * A Tree Action that the Tree or the Healer cannot apply: a destination that
 * is already occupied, a chain through a leaf, or a segment ID or locator
 * that does not parse. The message names which.
 */
export class TreeActionError extends Data.TaggedError("TreeActionError")<{
	readonly message: string;
}> {}
