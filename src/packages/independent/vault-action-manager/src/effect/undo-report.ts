import { Schema } from "effect";
import { VamDispatchFailureReasonSchema, VaultActionSchema } from "./errors";

/**
 * What probing the vault said about an action whose dispatch entry was
 * `Uncertain`: it `Landed`, it did not (`NotLanded`), or the vault holds
 * something neither explains (`Unknown`).
 */
export const VamUndoProbeSchema = Schema.Literals([
	"Landed",
	"NotLanded",
	"Unknown",
]);

export type VamUndoProbe = typeof VamUndoProbeSchema.Type;

/**
 * Why a change could not be undone:
 *
 * - `Changed`: the file no longer holds what the action left, so someone
 *   edited it since; it is left as it is.
 * - `Missing`: nothing is where the action left it any more.
 * - `Taken`: the path a rename came from is taken again, so moving back
 *   would land on another file.
 * - `NoPreImage`: the content a write replaced was not captured, because it
 *   was over the memory budget or the file changed before the write ran.
 * - `Unknown`: the action was `Uncertain` and probing could not tell
 *   whether it landed.
 * - `Failed`: the inverse failed for another reason (`io` or a defect) and
 *   did not land.
 * - `NotRun`: VAM did not run the inverse, being shut down or refusing it.
 */
export const VamUndoBlockSchema = Schema.Literals([
	"Changed",
	"Missing",
	"Taken",
	"NoPreImage",
	"Unknown",
	"Failed",
	"NotRun",
]);

export type VamUndoBlock = typeof VamUndoBlockSchema.Type;

/**
 * A change VAM leaves in place by design: a file or folder sent to the
 * trash (`Trashed`, `TrashedDuplicate`), or a folder or non-Markdown file
 * it created (`Created`), which no content guard can keep from trashing
 * what was put there since.
 */
export const VamNotUndoableSchema = Schema.Literals([
	"Created",
	"Trashed",
	"TrashedDuplicate",
]);

export type VamNotUndoable = typeof VamNotUndoableSchema.Type;

/**
 * What a guarded undo did after a Dispatch Batch stopped. Every entry names
 * the forward `action`, as the batch's report lists it. Inverses ran in
 * reverse run order, each guarded so that it changes only what the batch
 * left untouched.
 */
export class VamUndoReport extends Schema.Class<VamUndoReport>("VamUndoReport")(
	{
		/** Changes that stay, why, and the inverse tried, if any. */
		couldNotUndo: Schema.Array(
			Schema.Struct({
				action: VaultActionSchema,
				block: VamUndoBlockSchema,
				/** The inverse's failure, when one ran or VAM refused it. */
				error: Schema.optional(VamDispatchFailureReasonSchema),
				inverse: Schema.optional(VaultActionSchema),
			}),
		),
		/** Changes no inverse exists for. */
		notUndoable: Schema.Array(
			Schema.Struct({
				action: VaultActionSchema,
				what: VamNotUndoableSchema,
			}),
		),
		/** `Uncertain` actions and what the vault said about them. */
		probed: Schema.Array(
			Schema.Struct({
				action: VaultActionSchema,
				found: VamUndoProbeSchema,
			}),
		),
		/** Changes taken back, with the inverse that did it. */
		undone: Schema.Array(
			Schema.Struct({
				action: VaultActionSchema,
				inverse: VaultActionSchema,
			}),
		),
	},
) {
	/** Nothing to undo: the batch changed nothing. */
	static readonly empty = new VamUndoReport({
		couldNotUndo: [],
		notUndoable: [],
		probed: [],
		undone: [],
	});

	/** Whether the batch's changes are all gone: none stays or was not undoable. */
	get complete(): boolean {
		return this.couldNotUndo.length === 0 && this.notUndoable.length === 0;
	}
}
