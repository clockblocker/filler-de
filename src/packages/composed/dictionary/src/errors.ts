import { Schema } from "effect";

/** Scanning or re-reading `Worter/` failed, so the index could not be built. */
export class DictionaryScanError extends Schema.TaggedError<DictionaryScanError>()(
	"DictionaryScanError",
	{
		cause: Schema.Defect(),
		message: Schema.String,
	},
) {}

/**
 * A commit request dumdict's parsers reject, or a change the stored state
 * refuses, such as a Semantic Relation to a Lemma the dictionary does not
 * hold. Nothing was written.
 */
export class DictionaryRequestError extends Schema.TaggedError<DictionaryRequestError>()(
	"DictionaryRequestError",
	{
		cause: Schema.Defect(),
		message: Schema.String,
	},
) {}

/**
 * A new Lemma note's identity path holds a file the store does not hold as
 * that Lemma, such as a quarantined note. Nothing was written: the store
 * never overwrites a note it could not read.
 */
export class DictionaryPathOccupiedError extends Schema.TaggedError<DictionaryPathOccupiedError>()(
	"DictionaryPathOccupiedError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

/**
 * A note the commit would write does not parse back to the data it was
 * serialized from. Nothing was written.
 */
export class DictionaryRoundTripError extends Schema.TaggedError<DictionaryRoundTripError>()(
	"DictionaryRoundTripError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

/**
 * A commit's Dispatch Batch stopped at a failed write after at least one of
 * its writes had landed. Those writes stayed in the vault, so the commit is
 * partly applied; the store rebuilt its index from the files (`rebuilt`),
 * and its revision moved on. A batch that stopped before any write landed
 * is reported as a `revisionConflict` instead.
 */
export class DictionaryWriteError extends Schema.TaggedError<DictionaryWriteError>()(
	"DictionaryWriteError",
	{
		cause: Schema.Defect(),
		/** Vault paths of the writes that completed before the failure. */
		executed: Schema.Array(Schema.String),
		/**
		 * The write that stopped found its file changed by someone else: VAM
		 * failed it as a `conflict`, `exists` or `missing` and wrote nothing.
		 * A plan read from the files as they are now may land.
		 */
		externalChange: Schema.Boolean,
		message: Schema.String,
		rebuilt: Schema.Boolean,
		/** Vault paths of the writes never attempted. */
		skipped: Schema.Array(Schema.String),
	},
) {}

/**
 * A transaction's plans kept meeting changes made outside the store, such
 * as hand edits its compare-and-swaps found, until its attempts ran out.
 * Nothing of its last plan was written; `cause` is its last conflict.
 */
export class DictionaryTransactionConflict extends Schema.TaggedError<DictionaryTransactionConflict>()(
	"DictionaryTransactionConflict",
	{
		attempts: Schema.Number,
		cause: Schema.Defect(),
		message: Schema.String,
		/** What the last attempt met. */
		reason: Schema.String,
	},
) {}

export type DictionaryCommitError =
	| DictionaryScanError
	| DictionaryRequestError
	| DictionaryPathOccupiedError
	| DictionaryRoundTripError
	| DictionaryWriteError;
