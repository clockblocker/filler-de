import { Data } from "effect";

/** Scanning or re-reading `Worter/` failed, so the index could not be built. */
export class DictionaryScanError extends Data.TaggedError(
	"DictionaryScanError",
)<{
	readonly cause: unknown;
	readonly message: string;
}> {}

/**
 * A commit request dumdict's parsers reject, or a change the stored state
 * refuses, such as a Semantic Relation to a Lemma the dictionary does not
 * hold. Nothing was written.
 */
export class DictionaryRequestError extends Data.TaggedError(
	"DictionaryRequestError",
)<{
	readonly cause: unknown;
	readonly message: string;
}> {}

/**
 * A new Lemma note's identity path holds a file the store does not hold as
 * that Lemma, such as a quarantined note. Nothing was written: the store
 * never overwrites a note it could not read.
 */
export class DictionaryPathOccupiedError extends Data.TaggedError(
	"DictionaryPathOccupiedError",
)<{
	readonly message: string;
	readonly path: string;
}> {}

/**
 * A note the commit would write does not parse back to the data it was
 * serialized from. Nothing was written.
 */
export class DictionaryRoundTripError extends Data.TaggedError(
	"DictionaryRoundTripError",
)<{
	readonly message: string;
	readonly path: string;
}> {}

/**
 * A commit's Dispatch Batch stopped at a failed write after at least one of
 * its writes had landed. Those writes stayed in the vault, so the commit is
 * partly applied; the store rebuilt its index from the files (`rebuilt`),
 * and its revision moved on. A batch that stopped before any write landed
 * is reported as a `revisionConflict` instead.
 */
export class DictionaryWriteError extends Data.TaggedError(
	"DictionaryWriteError",
)<{
	readonly cause: unknown;
	/** Vault paths of the writes that completed before the failure. */
	readonly executed: readonly string[];
	/**
	 * The write that stopped found its file changed by someone else: VAM
	 * failed it as a `conflict`, `exists` or `missing` and wrote nothing.
	 * A plan read from the files as they are now may land.
	 */
	readonly externalChange: boolean;
	readonly message: string;
	readonly rebuilt: boolean;
	/** Vault paths of the writes never attempted. */
	readonly skipped: readonly string[];
	/**
	 * VAM failed the write that stopped as `io`, such as a file another
	 * process held (`EBUSY`), which may not recur. `transact` plans once
	 * more after a pause.
	 */
	readonly transient: boolean;
}> {}

/**
 * A transaction's plans kept meeting changes made outside the store, such
 * as hand edits its compare-and-swaps found, until its attempts ran out.
 * Nothing of its last plan was written; `cause` is its last conflict.
 */
export class DictionaryTransactionConflict extends Data.TaggedError(
	"DictionaryTransactionConflict",
)<{
	readonly attempts: number;
	readonly cause: unknown;
	readonly message: string;
	/** What the last attempt met. */
	readonly reason: string;
}> {}

/**
 * The refs into a renamed Scroll could not be rewritten (#99): looking up
 * how Obsidian resolves the Scroll's names failed, or the transaction did.
 * The refs still name the Scroll as before; `cause` says why.
 */
export class DictionaryRefRewriteError extends Data.TaggedError(
	"DictionaryRefRewriteError",
)<{
	readonly cause: unknown;
	readonly message: string;
}> {}

/**
 * dumdict's planner threw: the slice broke its storage contract, such as a
 * stored claim on a Lemma no readable note holds (a quarantined one), which
 * dumdict refuses to plan around (system ADR 0011). Nothing was planned.
 */
export class DictionaryPlanError extends Data.TaggedError(
	"DictionaryPlanError",
)<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export type DictionaryCommitError =
	| DictionaryPlanError
	| DictionaryScanError
	| DictionaryRequestError
	| DictionaryPathOccupiedError
	| DictionaryRoundTripError
	| DictionaryWriteError;
