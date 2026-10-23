import { Data } from "effect";
import type { VaultAction } from "../types/vault-action";
import type { VamDispatchFailureReason } from "./errors";

/**
 * What probing the vault said about an action whose dispatch entry was
 * `Uncertain`: it `Landed`, it did not (`NotLanded`), or the vault holds
 * something neither explains (`Unknown`).
 */
export type VamUndoProbe = "Landed" | "NotLanded" | "Unknown";

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
export type VamUndoBlock =
	| "Changed"
	| "Missing"
	| "Taken"
	| "NoPreImage"
	| "Unknown"
	| "Failed"
	| "NotRun";

/**
 * A change VAM leaves in place by design: a file or folder sent to the
 * trash (`Trashed`, `TrashedDuplicate`), or a folder or non-Markdown file
 * it created (`Created`), which no content guard can keep from trashing
 * what was put there since.
 */
export type VamNotUndoable = "Created" | "Trashed" | "TrashedDuplicate";

/**
 * What a guarded undo did after a Dispatch Batch stopped. Every entry names
 * the forward `action`, as the batch's report lists it. Inverses ran in
 * reverse run order, each guarded so that it changes only what the batch
 * left untouched.
 */
export class VamUndoReport extends Data.Class<{
	/** Changes that stay, why, and the inverse tried, if any. */
	readonly couldNotUndo: readonly {
		readonly action: VaultAction;
		readonly block: VamUndoBlock;
		/** The inverse's failure, when one ran or VAM refused it. */
		readonly error?: VamDispatchFailureReason | undefined;
		readonly inverse?: VaultAction | undefined;
	}[];
	/** Changes no inverse exists for. */
	readonly notUndoable: readonly {
		readonly action: VaultAction;
		readonly what: VamNotUndoable;
	}[];
	/** `Uncertain` actions and what the vault said about them. */
	readonly probed: readonly {
		readonly action: VaultAction;
		readonly found: VamUndoProbe;
	}[];
	/** Changes taken back, with the inverse that did it. */
	readonly undone: readonly {
		readonly action: VaultAction;
		readonly inverse: VaultAction;
	}[];
}> {
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
