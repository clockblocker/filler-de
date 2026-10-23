/**
 * Guarded undo on failure, a layer over `dispatchWithReport`: dispatch a
 * batch that stops at its first failure, then take back what its report
 * says landed, newest first, each inverse guarded by a precondition so it
 * changes only what nobody touched since. It is best effort, never a
 * transaction: a trash is not undone, Obsidian's link rewrites after a
 * rename are rewritten back only as far as its updater does, and other
 * writers (the user, Sync) may change files between the batch and its
 * undo. The report says which changes stay, and why.
 */
import { Cause, Effect, Exit, Predicate } from "effect";
import { vaultContentHash } from "../internal/content-hash";
import { splitPathCodec } from "../split-path-codec";
import type { AnySplitPath, SplitPathToMdFile } from "../types/split-path";
import { type VaultAction, VaultActionKind } from "../types/vault-action";
import { VaultPath } from "../vault-path";
import type { DispatchCaller, DispatchOptions } from "./dispatch-coordinator";
import {
	actionTarget,
	type VamActionOutcome,
	type VamDispatchEntry,
	VamDispatchFailure,
	VamDispatchReport,
} from "./dispatch-report";
import {
	causeValue,
	type VamActionFailureKind,
	VamDispatchError,
	type VamDispatchFailureReason,
	type VamEffectError,
} from "./errors";
import {
	type VamNotUndoable,
	type VamUndoBlock,
	type VamUndoProbe,
	VamUndoReport,
} from "./undo-report";

/** The public VAM operations guarded undo runs on. */
export type VamUndoPort = {
	readonly dispatchWithReport: (
		actions: readonly VaultAction[],
		options: DispatchOptions,
	) => Effect.Effect<VamDispatchReport, VamDispatchFailure>;
	readonly exists: (
		splitPath: AnySplitPath,
	) => Effect.Effect<boolean, VamEffectError>;
	readonly readContent: (
		splitPath: SplitPathToMdFile,
	) => Effect.Effect<string, VamEffectError>;
};

/**
 * `dispatchOrUndo`'s options: the batch's caller and operation, which its
 * inverses share.
 */
export type DispatchOrUndoOptions = DispatchCaller & {
	/**
	 * The most content, in UTF-16 code units, held as pre-images of the
	 * files the batch writes, for as long as the call runs. A write whose
	 * file is past it cannot be undone (`NoPreImage`). Defaults to
	 * `MAX_PRE_IMAGE_CHARS`.
	 */
	readonly maxPreImageChars?: number;
};

/** The default pre-image budget: 4 Mi code units, 8 MiB. */
export const MAX_PRE_IMAGE_CHARS = 4 * 1024 * 1024;

/**
 * What a file the batch writes held before it ran: no file, or its
 * content. A file not in the map was over the budget or unreadable.
 */
type PreImage =
	| { readonly _tag: "Absent" }
	| { readonly _tag: "Content"; readonly content: string };

const ABSENT: PreImage = { _tag: "Absent" };

type PreImages = ReadonlyMap<string, PreImage>;

/**
 * What the vault held before the batch was submitted: the pre-images of
 * the files it writes, and, for each path a create or a rename targets,
 * whether something was there (`undefined` when the lookup failed). A probe
 * never takes a file that was there before for one the batch put there.
 * An `Uncertain` entry's own `targetTaken`, from its action's collision
 * check immediately before it wrote or moved, replaces the target's record
 * here: a file can arrive at the target, or leave it, while the batch waits
 * in the queue or the rename reads ahead of its move. The record here
 * serves a port whose entries do not say, actions a dying dispatch never
 * reported, and actions that failed before their check, which moved
 * nothing.
 */
type BeforeBatch = {
	readonly images: PreImages;
	readonly targets: ReadonlyMap<string, boolean | undefined>;
};

/** How one stopped batch's change is taken back, if at all. */
type UndoPlan =
	| { readonly _tag: "Nothing" }
	| { readonly _tag: "NotUndoable"; readonly what: VamNotUndoable }
	| { readonly _tag: "Blocked"; readonly block: VamUndoBlock }
	| {
			readonly _tag: "Invert";
			readonly inverse: VaultAction;
			/** Whether the inverse landed, for an inverse that ended `Uncertain`. */
			readonly landed: Effect.Effect<VamUndoProbe>;
	  };

type InverseResult =
	| { readonly _tag: "Undone" }
	| {
			readonly _tag: "Blocked";
			readonly block: VamUndoBlock;
			readonly error?: VamDispatchFailureReason;
	  };

const NOTHING: UndoPlan = { _tag: "Nothing" };
const UNDONE: InverseResult = { _tag: "Undone" };

/**
 * Dispatches `actions` as one batch that stops at its first failure. On
 * success it answers the batch's report. On failure it undoes what landed,
 * in reverse run order, and fails with the batch's `VamDispatchFailure`,
 * whose report's `undo` says what was taken back. The failure keeps the
 * batch's whole cause: the `VamDispatchFailure` is its first failure, and
 * every other reason, such as a finalizer's defect, follows it, then those
 * beside each inverse batch's failure. `Effect.catch` or `catchTag` get the
 * `VamDispatchFailure`; `catchCause` gets every reason.
 *
 * - `Created` → the file is trashed only while it holds the content it was
 *   created with. Created folders and non-Markdown files stay.
 * - `Wrote` → the pre-image is restored only while the file holds what the
 *   write left. Pre-images are read before the batch, within
 *   `maxPreImageChars`.
 * - `Renamed`, `RenamedToIndexed` → renamed back only while the file is
 *   where it went and its old path is free (`onCollision: "fail"`).
 * - `Trashed`, `TrashedDuplicate` → not undoable.
 * - `Uncertain` → probed; only one that landed is undone, guarded as above.
 *   A create or rename whose target was taken when it ran is never found
 *   to have landed there.
 *
 * Each inverse runs as its own batch, after the ones before it, so none is
 * reordered among the others; every one is attempted.
 */
export const dispatchOrUndoVia = Effect.fn("vam.dispatchOrUndo")(function* (
	port: VamUndoPort,
	actions: readonly VaultAction[],
	options: DispatchOrUndoOptions,
): Effect.fn.Return<VamDispatchReport, VamDispatchFailure> {
	const { maxPreImageChars = MAX_PRE_IMAGE_CHARS, ...caller } = options;
	const before = yield* captureBefore(port, actions, maxPreImageChars);
	const exit = yield* Effect.exit(
		port.dispatchWithReport(actions, {
			...caller,
			stopOnFirstFailure: true,
		}),
	);
	if (Exit.isSuccess(exit)) return exit.value;
	const stopped = stoppedBatch(exit.cause, actions, caller);
	if (!stopped) return yield* Effect.failCause(exit.cause);
	const besideInverses: Cause.Reason<VamDispatchFailure>[] = [];
	const undo = yield* undoStopped(
		port,
		stopped.report,
		before,
		inverseOptions(stopped.report),
		(reasons) => besideInverses.push(...reasons),
	);
	const failure = new VamDispatchFailure({
		reason: stopped.reason,
		report: new VamDispatchReport({ ...stopped.report, undo }),
	});
	return yield* Effect.failCause(
		Cause.fromReasons([
			...withFailure(exit.cause, failure),
			...besideInverses,
		]),
	);
});

/**
 * The stopped batch's reasons, with its first failure replaced by
 * `failure`, which carries the undo, and every other reason kept in order.
 * A cause without a failure is `failure` alone: `stoppedBatch` made it
 * from that cause, and each of its entries holds the cause's defects.
 */
function withFailure(
	cause: Cause.Cause<VamDispatchFailure>,
	failure: VamDispatchFailure,
): readonly Cause.Reason<VamDispatchFailure>[] {
	const first = cause.reasons.findIndex(Cause.isFailReason);
	if (first < 0) return [Cause.makeFailReason(failure)];
	return cause.reasons.map((reason, index) =>
		index === first ? Cause.makeFailReason(failure) : reason,
	);
}

/**
 * The options of the inverse batches: the forward batch's caller and
 * operation, as its report names them, so the undo shows up in spans,
 * reports and event origins as part of the same operation. Each inverse is
 * one action, attempted on its own.
 */
function inverseOptions(forward: VamDispatchReport): DispatchOptions {
	return {
		caller: forward.caller,
		operationId: forward.operationId,
		stopOnFirstFailure: false,
	};
}

/**
 * The failure of the stopped batch. VAM answers a report for every failure
 * it knows; a defect says nothing about which actions ran, so every action
 * counts as `Uncertain` and is probed.
 */
function stoppedBatch(
	cause: Cause.Cause<VamDispatchFailure>,
	actions: readonly VaultAction[],
	{ caller, operationId }: DispatchCaller,
): VamDispatchFailure | undefined {
	const failed = cause.reasons.find(Cause.isFailReason);
	if (failed) return failed.error;
	if (!cause.reasons.some(Cause.isDieReason)) return undefined;
	const errors = actions.map(
		(action) =>
			new VamDispatchError({
				action,
				cause: causeValue(cause),
				kind: "defect",
				operation: "dispatch",
			}),
	);
	const [first] = errors;
	if (!first) return undefined;
	return new VamDispatchFailure({
		reason: first,
		report: new VamDispatchReport({
			caller,
			entries: errors.map((error) => VamDispatchReport.entryFor(error)),
			// The facade always names the operation; a bare port may not.
			operationId: operationId ?? `${caller}#undefined`,
		}),
	});
}

/**
 * Reads what each file the batch may write holds now, within `budget`:
 * a `ProcessMdFile`'s file, or a contentful `UpsertMdFile`'s, and whether
 * an upsert's file is there at all; and whether something is at each
 * path a create or a rename targets.
 */
const captureBefore = Effect.fnUntraced(function* (
	port: VamUndoPort,
	actions: readonly VaultAction[],
	budget: number,
): Effect.fn.Return<BeforeBatch> {
	const images = new Map<string, PreImage>();
	const targets = new Map<string, boolean | undefined>();
	let left = budget;
	for (const action of actions) {
		const target = actionTarget(action);
		if (target) {
			const key = keyOf(target);
			if (!targets.has(key))
				targets.set(key, yield* settle(port.exists(target)));
			continue;
		}
		if (
			action.kind !== VaultActionKind.ProcessMdFile &&
			action.kind !== VaultActionKind.UpsertMdFile
		)
			continue;
		const { splitPath } = action.payload;
		const key = keyOf(splitPath);
		if (images.has(key)) continue;
		const present = yield* settle(port.exists(splitPath));
		if (present === false) {
			images.set(key, ABSENT);
			continue;
		}
		const contentful =
			action.kind === VaultActionKind.ProcessMdFile ||
			(action.payload.content !== null &&
				action.payload.content !== undefined);
		if (present !== true || !contentful) continue;
		const content = yield* settle(port.readContent(splitPath));
		if (content === undefined || content.length > left) continue;
		left -= content.length;
		images.set(key, { _tag: "Content", content });
	}
	return { images, targets };
});

const undoStopped = Effect.fn("vam.undo")(function* (
	port: VamUndoPort,
	report: VamDispatchReport,
	before: BeforeBatch,
	options: DispatchOptions,
	onBeside: (reasons: readonly Cause.Reason<VamDispatchFailure>[]) => void,
) {
	const couldNotUndo: VamUndoReport["couldNotUndo"][number][] = [];
	const notUndoable: VamUndoReport["notUndoable"][number][] = [];
	const probed: VamUndoReport["probed"][number][] = [];
	const undone: VamUndoReport["undone"][number][] = [];
	for (const entry of [...report.entries].reverse()) {
		const { action } = entry;
		const plan = yield* planUndo(port, entry, before, (found) =>
			probed.push({ action, found }),
		);
		switch (plan._tag) {
			case "Nothing":
				break;
			case "NotUndoable":
				notUndoable.push({ action, what: plan.what });
				break;
			case "Blocked":
				couldNotUndo.push({ action, block: plan.block });
				break;
			case "Invert": {
				const result = yield* runInverse(port, plan, options, onBeside);
				if (result._tag === "Undone") {
					undone.push({ action, inverse: plan.inverse });
					break;
				}
				couldNotUndo.push({
					action,
					block: result.block,
					inverse: plan.inverse,
					...(result.error ? { error: result.error } : {}),
				});
				break;
			}
		}
	}
	yield* Effect.annotateCurrentSpan({
		"undo.couldNotUndo": couldNotUndo.length,
		"undo.notUndoable": notUndoable.length,
		"undo.probed": probed.length,
		"undo.undone": undone.length,
	});
	if (couldNotUndo.length > 0)
		yield* Effect.logWarning("[VAM] Undo left changes in place", {
			changes: couldNotUndo.map(
				({ action, block }) => `${describe(action)}: ${block}`,
			),
		});
	return new VamUndoReport({ couldNotUndo, notUndoable, probed, undone });
});

/** The undo of one report entry; probes an `Uncertain` one first. */
const planUndo = Effect.fnUntraced(function* (
	port: VamUndoPort,
	entry: VamDispatchEntry,
	before: BeforeBatch,
	onProbed: (found: VamUndoProbe) => void,
): Effect.fn.Return<UndoPlan> {
	const preImages = before.images;
	switch (entry.status) {
		case "Failed":
		case "Skipped":
			return NOTHING;
		case "Done":
			return inverseOfOutcome(
				port,
				entry.action,
				entry.outcome,
				preImages,
			);
		case "Uncertain": {
			const found = yield* probeForward(
				port,
				entry.action,
				before,
				entry.targetTaken,
			);
			onProbed(found);
			switch (found) {
				case "Landed":
					return inverseOfLanded(port, entry.action, preImages);
				case "NotLanded":
					return NOTHING;
				case "Unknown":
					return { _tag: "Blocked", block: "Unknown" };
			}
		}
	}
});

/** The guarded inverse of what a completed action's receipt says it did. */
function inverseOfOutcome(
	port: VamUndoPort,
	action: VaultAction,
	outcome: VamActionOutcome,
	preImages: PreImages,
): UndoPlan {
	switch (outcome._tag) {
		case "NoOp":
			return NOTHING;
		case "Trashed":
		case "TrashedDuplicate":
			return { _tag: "NotUndoable", what: outcome._tag };
		case "Created":
			return trashCreated(port, action, outcome.contentHash);
		case "Wrote":
			return restoreWrite(
				port,
				action,
				preImages,
				outcome.beforeHash,
				outcome.afterHash,
			);
		case "Renamed":
		case "RenamedToIndexed":
			return renameBack(port, action, outcome.to);
	}
}

/** The guarded inverse of an `Uncertain` action that probing found landed. */
function inverseOfLanded(
	port: VamUndoPort,
	action: VaultAction,
	preImages: PreImages,
): UndoPlan {
	switch (action.kind) {
		case VaultActionKind.CreateMdFile:
			return trashCreated(port, action, undefined);
		case VaultActionKind.UpsertMdFile: {
			const before = preImages.get(keyOf(action.payload.splitPath));
			const { content } = action.payload;
			if (before?._tag === "Content" && Predicate.isString(content))
				return restoreWrite(
					port,
					action,
					preImages,
					vaultContentHash(before.content),
					vaultContentHash(content),
				);
			return trashCreated(port, action, undefined);
		}
		case VaultActionKind.RenameMdFile:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameFolder:
			return renameBack(port, action, action.payload.to);
		case VaultActionKind.TrashMdFile:
		case VaultActionKind.TrashFile:
		case VaultActionKind.TrashFolder:
			return { _tag: "NotUndoable", what: "Trashed" };
		case VaultActionKind.CreateFolder:
		case VaultActionKind.CreateFile:
			return { _tag: "NotUndoable", what: "Created" };
		case VaultActionKind.ProcessMdFile:
			return { _tag: "Blocked", block: "Unknown" };
	}
}

/**
 * A created Markdown file to the trash, only while it holds `contentHash`,
 * what it was created with. A folder or another file has no such guard.
 */
function trashCreated(
	port: VamUndoPort,
	action: VaultAction,
	contentHash: string | undefined,
): UndoPlan {
	if (
		action.kind !== VaultActionKind.CreateMdFile &&
		action.kind !== VaultActionKind.UpsertMdFile
	)
		return { _tag: "NotUndoable", what: "Created" };
	const { splitPath } = action.payload;
	const hash = contentHash ?? vaultContentHash(action.payload.content ?? "");
	return {
		_tag: "Invert",
		inverse: {
			kind: VaultActionKind.TrashMdFile,
			payload: { ifContent: { hash }, splitPath },
		},
		landed: probeGone(port, splitPath),
	};
}

/** The pre-image back, only while the file holds what the write left. */
function restoreWrite(
	port: VamUndoPort,
	action: VaultAction,
	preImages: PreImages,
	beforeHash: string,
	afterHash: string,
): UndoPlan {
	if (
		action.kind !== VaultActionKind.ProcessMdFile &&
		action.kind !== VaultActionKind.UpsertMdFile
	)
		return { _tag: "Blocked", block: "NoPreImage" };
	const { splitPath } = action.payload;
	const before = preImages.get(keyOf(splitPath));
	if (
		before?._tag !== "Content" ||
		vaultContentHash(before.content) !== beforeHash
	)
		return { _tag: "Blocked", block: "NoPreImage" };
	const { content } = before;
	return {
		_tag: "Invert",
		inverse: {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				expected: { hash: afterHash },
				splitPath,
				transform: () => content,
			},
		},
		landed: probeContent(port, splitPath, beforeHash, afterHash),
	};
}

/**
 * The rename from `to` back to where the action moved from, with the
 * action's link policy, failing rather than landing on a taken name.
 */
function renameBack(
	port: VamUndoPort,
	action: VaultAction,
	to: AnySplitPath,
): UndoPlan {
	const inverse = renameFrom(action, to);
	if (!inverse) return { _tag: "Blocked", block: "Unknown" };
	return {
		_tag: "Invert",
		inverse,
		landed: probeRename(port, inverse.payload.from, inverse.payload.to),
	};
}

type RenameAction = Extract<
	VaultAction,
	{
		kind:
			| typeof VaultActionKind.RenameMdFile
			| typeof VaultActionKind.RenameFile
			| typeof VaultActionKind.RenameFolder;
	}
>;

function renameFrom(
	action: VaultAction,
	to: AnySplitPath,
): RenameAction | undefined {
	switch (action.kind) {
		case VaultActionKind.RenameMdFile:
			return to.kind === "MdFile"
				? {
						kind: action.kind,
						payload: {
							...action.payload,
							from: to,
							onCollision: "fail",
							to: action.payload.from,
						},
					}
				: undefined;
		case VaultActionKind.RenameFile:
			return to.kind === "File"
				? {
						kind: action.kind,
						payload: {
							...action.payload,
							from: to,
							onCollision: "fail",
							to: action.payload.from,
						},
					}
				: undefined;
		case VaultActionKind.RenameFolder:
			return to.kind === "Folder"
				? {
						kind: action.kind,
						payload: {
							...action.payload,
							from: to,
							onCollision: "fail",
							to: action.payload.from,
						},
					}
				: undefined;
		default:
			return undefined;
	}
}

/**
 * Whether an `Uncertain` action landed, from the vault as it is now. Only
 * evidence counts: a rename landed when its file is at `to` and not at
 * `from`, a create when its file holds what it was created with, and
 * neither when something was at its target when it ran, since that may be
 * what is there now (a rename that went to an indexed name or trashed a
 * duplicate, a create VAM refused). `targetTaken` is the entry's record of
 * that; without one, the record from before the batch stands in.
 */
const probeForward = Effect.fn("vam.undo.probe")(function* (
	port: VamUndoPort,
	action: VaultAction,
	batch: BeforeBatch,
	targetTaken: boolean | undefined,
): Effect.fn.Return<VamUndoProbe> {
	yield* Effect.annotateCurrentSpan({ "action.kind": action.kind });
	const preImages = batch.images;
	const target = actionTarget(action);
	const held = target
		? (targetTaken ?? batch.targets.get(keyOf(target)))
		: false;
	switch (action.kind) {
		case VaultActionKind.RenameMdFile:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameFolder: {
			const { from, to } = action.payload;
			// A rename that changes only its own name's case finds itself.
			const ownCase = VaultPath.caseInsensitive.same(
				splitPathCodec.format(from),
				splitPathCodec.format(to),
			);
			if (held !== false && !ownCase) return "Unknown";
			return yield* probeRename(port, from, to);
		}
		case VaultActionKind.TrashMdFile:
		case VaultActionKind.TrashFile:
		case VaultActionKind.TrashFolder:
			return yield* probeGone(port, action.payload.splitPath);
		case VaultActionKind.CreateFolder:
		case VaultActionKind.CreateFile: {
			if (held !== false) return held ? "NotLanded" : "Unknown";
			const present = yield* settle(
				port.exists(action.payload.splitPath),
			);
			if (present === undefined) return "Unknown";
			return present ? "Landed" : "NotLanded";
		}
		case VaultActionKind.CreateMdFile:
			// A create refuses a taken path, and a batch that trashes its
			// path as well only trashes it, so a file there before is not
			// the create's.
			if (held !== false) return held ? "NotLanded" : "Unknown";
			return yield* probeContent(
				port,
				action.payload.splitPath,
				vaultContentHash(action.payload.content ?? ""),
				ABSENT,
			);
		case VaultActionKind.UpsertMdFile: {
			const { content, splitPath } = action.payload;
			const before = preImages.get(keyOf(splitPath));
			if (before?._tag === "Absent")
				return yield* probeContent(
					port,
					splitPath,
					vaultContentHash(content ?? ""),
					ABSENT,
				);
			if (before === undefined || !Predicate.isString(content))
				return before === undefined ? "Unknown" : "NotLanded";
			if (content === before.content) return "NotLanded";
			return yield* probeContent(
				port,
				splitPath,
				vaultContentHash(content),
				vaultContentHash(before.content),
			);
		}
		case VaultActionKind.ProcessMdFile: {
			const before = preImages.get(keyOf(action.payload.splitPath));
			if (before?._tag !== "Content") return "Unknown";
			// A transform's result is unknown, so only "nothing changed" is evidence.
			return yield* probeContent(
				port,
				action.payload.splitPath,
				undefined,
				vaultContentHash(before.content),
			);
		}
	}
});

/**
 * Runs one inverse on its own and says whether it took the change back.
 * The reasons beside the inverse's failure, which its result has no room
 * for, go to `onBeside`.
 */
const runInverse = Effect.fnUntraced(function* (
	port: VamUndoPort,
	plan: Extract<UndoPlan, { _tag: "Invert" }>,
	options: DispatchOptions,
	onBeside: (reasons: readonly Cause.Reason<VamDispatchFailure>[]) => void,
): Effect.fn.Return<InverseResult> {
	const exit = yield* Effect.exit(
		port.dispatchWithReport([plan.inverse], options),
	);
	if (Exit.isSuccess(exit)) {
		const entry = entryOf(exit.value, plan.inverse);
		return entry?.status === "Done" && !trashedNothing(entry)
			? UNDONE
			: // VAM leaves out a trash whose file is gone, or reports it NoOp.
				{ _tag: "Blocked", block: "Missing" };
	}
	const failed = exit.cause.reasons.find(Cause.isFailReason);
	if (!failed) {
		if (!exit.cause.reasons.some(Cause.isDieReason))
			return yield* Effect.interrupt;
		return {
			_tag: "Blocked",
			block: "Failed",
			error: new VamDispatchError({
				action: plan.inverse,
				cause: causeValue(exit.cause),
				kind: "defect",
				operation: "undo",
			}),
		};
	}
	onBeside(exit.cause.reasons.filter((other) => other !== failed));
	const { reason, report } = failed.error;
	const entry = entryOf(report, plan.inverse);
	switch (entry?.status) {
		case "Done":
			return UNDONE;
		case "Failed":
			return {
				_tag: "Blocked",
				block: blockOf(entry.error.kind),
				error: entry.error,
			};
		case "Uncertain":
			return (yield* plan.landed) === "Landed"
				? UNDONE
				: { _tag: "Blocked", block: "Failed", error: entry.error };
		default:
			return {
				_tag: "Blocked",
				block: reason instanceof VamDispatchError ? "Failed" : "NotRun",
				error: reason,
			};
	}
});

function blockOf(kind: VamActionFailureKind): VamUndoBlock {
	switch (kind) {
		case "conflict":
			return "Changed";
		case "exists":
			return "Taken";
		case "missing":
			return "Missing";
		case "io":
		case "defect":
		case "interrupted":
			return "Failed";
	}
}

function trashedNothing(entry: VamDispatchEntry): boolean {
	return (
		entry.status === "Done" &&
		entry.outcome._tag === "NoOp" &&
		(entry.action.kind === VaultActionKind.TrashMdFile ||
			entry.action.kind === VaultActionKind.TrashFile ||
			entry.action.kind === VaultActionKind.TrashFolder)
	);
}

/** A rename landed when its file is at `to` and not at `from`. */
function probeRename(
	port: VamUndoPort,
	from: AnySplitPath,
	to: AnySplitPath,
): Effect.Effect<VamUndoProbe> {
	return Effect.suspend(() =>
		Effect.all([settle(port.exists(from)), settle(port.exists(to))]),
	).pipe(
		Effect.map(([atFrom, atTo]): VamUndoProbe => {
			if (atTo === true && atFrom === false) return "Landed";
			if (atFrom === true && atTo === false) return "NotLanded";
			return "Unknown";
		}),
	);
}

/** A trash landed when nothing is at its path. */
function probeGone(
	port: VamUndoPort,
	splitPath: AnySplitPath,
): Effect.Effect<VamUndoProbe> {
	return Effect.suspend(() => settle(port.exists(splitPath))).pipe(
		Effect.map((present): VamUndoProbe => {
			if (present === undefined) return "Unknown";
			return present ? "NotLanded" : "Landed";
		}),
	);
}

/**
 * A write landed when its file holds `landedHash`, and did not when it
 * holds `notLandedHash`, or is absent when it was absent before.
 */
const probeContent = Effect.fnUntraced(function* (
	port: VamUndoPort,
	splitPath: SplitPathToMdFile,
	landedHash: string | undefined,
	notLanded: string | PreImage,
): Effect.fn.Return<VamUndoProbe> {
	const present = yield* settle(port.exists(splitPath));
	if (present === undefined) return "Unknown";
	if (!present) return notLanded === ABSENT ? "NotLanded" : "Unknown";
	const content = yield* settle(port.readContent(splitPath));
	if (content === undefined) return "Unknown";
	const hash = vaultContentHash(content);
	if (hash === landedHash) return "Landed";
	if (hash === notLanded) return "NotLanded";
	return "Unknown";
});

/** The report entry of a one-action inverse batch, past any parent folders VAM added. */
function entryOf(
	report: VamDispatchReport,
	inverse: VaultAction,
): VamDispatchEntry | undefined {
	return report.entries.find((entry) => sameAction(entry.action, inverse));
}

function sameAction(a: VaultAction, b: VaultAction): boolean {
	if (a.kind !== b.kind) return false;
	const [aFrom, aTo] = pathsOf(a);
	const [bFrom, bTo] = pathsOf(b);
	return aFrom === bFrom && aTo === bTo;
}

function pathsOf(action: VaultAction): readonly [string, string | undefined] {
	switch (action.kind) {
		case VaultActionKind.RenameMdFile:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameFolder:
			return [keyOf(action.payload.from), keyOf(action.payload.to)];
		default:
			return [keyOf(action.payload.splitPath), undefined];
	}
}

/** A path as Obsidian's lookup keys it. */
function keyOf(splitPath: AnySplitPath): string {
	return VaultPath.caseSensitive.key(splitPathCodec.format(splitPath));
}

function describe(action: VaultAction): string {
	const [from, to] = pathsOf(action);
	return to === undefined
		? `${action.kind} ${from}`
		: `${action.kind} ${from} → ${to}`;
}

/** The effect's value, or undefined when it fails or dies. */
function settle<A, E>(
	effect: Effect.Effect<A, E>,
): Effect.Effect<A | undefined> {
	return Effect.exit(effect).pipe(
		Effect.map((exit) => (Exit.isSuccess(exit) ? exit.value : undefined)),
	);
}
