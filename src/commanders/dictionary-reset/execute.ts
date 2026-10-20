/**
 * "Reset dictionary from old notes…" (#65): one pipeline in two modes.
 *
 * - **Dry run**: Collect and plan, then the report. It reads only: no
 *   backup, no write, no provider call.
 * - **Execute**: Collect and plan; move `Worter/` to a dated backup folder
 *   and check every old file arrived there; regenerate each attestation by
 *   running Classify over its Segment, through the same `UnitResolver` and
 *   dictionary store as the command; re-attach each freeform Block to the
 *   Lemma regenerated for its note's headword; write the report note.
 *
 * Nothing here deletes: the vault port has no delete, the backup is a
 * move, and every write either creates a new file or goes through the
 * store's compare-and-swap. Attestations run one at a time, and each waits
 * for its Reading's background Knowledge, so the run never asks dumgen
 * for more than one Classify at once. Cancelling lets the current
 * Classify finish, stops waiting for Knowledge, and regenerates nothing
 * more; the freeform text of what was regenerated is still re-attached,
 * and the report still written.
 */
import { Cause, Deferred, Effect, Option, Schema } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import {
	type ClassifyError,
	type ClassifySegmenter,
	classifySelection,
} from "../classify/classify-selection";
import type { SegmentationCache } from "../classify/segmentation-cache";
import type { UnitResolver } from "../classify/unit-resolver";
import {
	collectOldNotes,
	headwordKey,
	type OldFile,
	planReset,
	type ResetPlan,
	type ResetSources,
	targetAttestation,
	WORTER,
} from "./plan";
import {
	type FreeformResult,
	type RegenerationResult,
	type ResetExecution,
	renderReport,
} from "./report";

export class ResetFailed extends Schema.TaggedError<ResetFailed>()(
	"ResetFailed",
	{
		cause: Schema.Defect(),
		message: Schema.String,
	},
) {}

/** The reads and the few writes the reset makes, without any delete. */
export type ResetVault = ResetSources & {
	/** Every file below `folder`; undefined when there is no such folder. */
	readonly listFolder: (folder: string) => Effect.Effect<
		| {
				readonly markdown: readonly OldFile[];
				readonly other: readonly string[];
		  }
		| undefined,
		ResetFailed
	>;
	readonly exists: (path: string) => Effect.Effect<boolean>;
	/** Moves a folder with everything in it; fails rather than merge. */
	readonly moveFolder: (
		from: string,
		to: string,
	) => Effect.Effect<void, ResetFailed>;
	/** Creates a Markdown note; fails rather than overwrite one. */
	readonly createNote: (
		path: string,
		content: string,
	) => Effect.Effect<void, ResetFailed>;
};

/** The dictionary store and the Knowledge queue, as the reset uses them. */
export type ResetDictionary = {
	/** Reads `Worter/` again after the backup moved it through VAM. */
	readonly rescan: Effect.Effect<void, ResetFailed>;
	readonly appendFreeform: (request: {
		readonly path: string;
		readonly readingBlockId: string;
		readonly text: string;
	}) => Effect.Effect<"Appended" | "AlreadyThere", ResetFailed>;
	/** Waits until no background Knowledge run is going. */
	readonly settleKnowledge: Effect.Effect<void>;
};

export type ResetProgress = {
	readonly stage: "Collect" | "Backup" | "Regenerate" | "Reattach" | "Report";
	readonly done: number;
	readonly total: number;
	readonly label?: string;
};

export type DryRunResult = {
	readonly plan: ResetPlan;
	readonly report: string;
};

export type ExecuteResult = DryRunResult & {
	readonly execution: ResetExecution;
	readonly reportPath: string;
};

/** Collect: every old note under `Worter/`, read. */
export const collectWorter = Effect.fnUntraced(function* (vault: ResetVault) {
	const listed = yield* vault.listFolder(WORTER);
	if (!listed)
		return yield* new ResetFailed({
			cause: WORTER,
			message: `There is no ${WORTER}/ folder to reset`,
		});
	if (listed.markdown.length === 0 && listed.other.length === 0)
		return yield* new ResetFailed({
			cause: WORTER,
			message: `${WORTER}/ is empty; there is nothing to reset`,
		});
	return {
		collected: collectOldNotes(listed.markdown, listed.other),
		/** Each note's content as Collect read it, by path. */
		contents: new Map(
			listed.markdown.map(({ content, path }) => [path, content]),
		) as ReadonlyMap<string, string>,
	};
});

/** Dry run: Collect, plan and report, reading only. */
export const dryRunReset = Effect.fn("dryRunReset")(function* (
	vault: ResetVault,
): Effect.fn.Return<DryRunResult, ResetFailed> {
	const { collected } = yield* collectWorter(vault);
	const plan = yield* planReset(vault, collected);
	return { plan, report: renderReport(plan) };
});

const pad = (value: number) => String(value).padStart(2, "0");

/** `2026-10-20 15-04-05`: a stamp a folder name can hold. */
export function resetStamp(parts: {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}): string {
	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}-${pad(parts.minute)}-${pad(parts.second)}`;
}

/** The first of `base`, `base 2`, `base 3`, … that no file or folder holds. */
const freePath = Effect.fnUntraced(function* (
	vault: ResetVault,
	base: string,
	extension = "",
) {
	for (let index = 1; index < 100; index++) {
		const path = `${base}${index === 1 ? "" : ` ${index}`}${extension}`;
		if (!(yield* vault.exists(path))) return path;
	}
	return yield* new ResetFailed({
		cause: base,
		message: `Every name like "${base}" is taken`,
	});
});

/**
 * Reads `Worter/` again right before the move, so an edit since Collect
 * stops the reset while nothing has moved yet.
 */
const checkUnchanged = Effect.fnUntraced(function* (
	vault: ResetVault,
	plan: ResetPlan,
	contents: ReadonlyMap<string, string>,
): Effect.fn.Return<void, ResetFailed> {
	const now = yield* vault.listFolder(WORTER);
	const unchanged =
		now !== undefined &&
		now.markdown.length === contents.size &&
		now.markdown.every(
			({ content, path }) => contents.get(path) === content,
		) &&
		now.other.length === plan.collected.otherFiles.length;
	if (!unchanged)
		return yield* new ResetFailed({
			cause: WORTER,
			message: `${WORTER}/ changed while the reset read it. Nothing was moved; run the reset again`,
		});
});

/**
 * Moves `Worter/` to the backup folder, then checks the move: `Worter/` is
 * gone and every file Collect read sits in the backup with the content it
 * read. Anything else stops the reset before it writes anything more. It
 * answers the backup's files that Collect never read.
 */
const backUp = Effect.fnUntraced(function* (
	vault: ResetVault,
	plan: ResetPlan,
	contents: ReadonlyMap<string, string>,
	backupFolder: string,
): Effect.fn.Return<readonly string[], ResetFailed> {
	yield* vault.moveFolder(WORTER, backupFolder);
	const moved = yield* vault.listFolder(backupFolder);
	const stop = (message: string) =>
		new ResetFailed({
			cause: backupFolder,
			message: `${message}. The reset stopped before regenerating anything; nothing was deleted. Check ${backupFolder}/ and ${WORTER}/; to undo, move ${backupFolder}/ back to ${WORTER}/ by hand`,
		});
	if (!moved)
		return yield* stop(`The backup folder ${backupFolder}/ is missing`);
	if (yield* vault.exists(WORTER))
		return yield* stop(`${WORTER}/ is still there after the move`);
	const backedUp = new Map(
		moved.markdown.map(({ content, path }) => [path, content]),
	);
	const otherFiles = new Set(moved.other);
	const relocate = (path: string) =>
		`${backupFolder}${path.slice(WORTER.length)}`;
	for (const note of plan.collected.notes) {
		const content = backedUp.get(relocate(note.path));
		if (content === undefined || content !== contents.get(note.path))
			return yield* stop(
				`${relocate(note.path)} is not in the backup as it was read`,
			);
	}
	for (const path of plan.collected.otherFiles)
		if (!otherFiles.has(relocate(path)))
			return yield* stop(`${relocate(path)} is not in the backup`);
	// Files that arrived between the last read and the move: kept in the
	// backup, never read, and named in the report.
	const planned = new Set([
		...plan.collected.notes.map(({ path }) => relocate(path)),
		...plan.collected.otherFiles.map(relocate),
	]);
	return [...backedUp.keys(), ...otherFiles].filter(
		(path) => !planned.has(path),
	);
});

type Cancellation = Deferred.Deferred<void>;

/** Runs `effect` unless the reset was cancelled first or meanwhile. */
const unlessCancelled = <A, E, R>(
	cancel: Cancellation,
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<Option.Option<A>, E, R> =>
	Effect.raceFirst(
		effect.pipe(Effect.map(Option.some)),
		Deferred.await(cancel).pipe(Effect.as(Option.none<A>())),
	);

const pendingReasons = (
	resolutions: readonly { readonly _tag: string; readonly reason?: string }[],
) => [
	...new Set(
		resolutions.flatMap(({ reason }) =>
			reason === undefined ? [] : [reason],
		),
	),
];

/** Classify over one attestation's Segment, as the command runs it. */
const regenerateOne = Effect.fnUntraced(function* (
	vault: ResetVault,
	plan: ResetPlan,
	index: number,
	backupFolder: string,
): Effect.fn.Return<
	RegenerationResult,
	never,
	ClassifySegmenter | SegmentationCache | UnitResolver
> {
	const planned = plan.attestations[index];
	if (!planned) return { _tag: "Unresolved", reason: "it is not planned" };
	// The source is read again: the backup's move may have rewritten links.
	const target = yield* targetAttestation(
		vault,
		{ forms: planned.forms, path: planned.notePath },
		planned.attestation,
		[WORTER, backupFolder],
	);
	if (target._tag === "Unresolvable")
		return { _tag: "Unresolved", reason: target.reason };
	const outcome = yield* classifySelection({
		content: target.content,
		scrollPath: target.scrollPath,
		selection: target.selection,
	}).pipe(
		Effect.map(
			(classified) => ({ _tag: "Classified", classified }) as const,
		),
		Effect.catchTag("ClassifyError", (error: ClassifyError) =>
			Effect.succeed({ _tag: "Failed", reason: error.message } as const),
		),
		Effect.catchCause((cause) =>
			Cause.hasInterruptsOnly(cause)
				? Effect.failCause(cause)
				: Effect.succeed({
						_tag: "Failed",
						reason: `Classify failed unexpectedly: ${getErrorMessage(Cause.squash(cause))}`,
					} as const),
		),
	);
	if (outcome._tag === "Failed")
		return { _tag: "Unresolved", reason: outcome.reason };
	const { resolutions } = outcome.classified;
	const resolved = resolutions.find(
		(resolution) => resolution._tag === "Resolved",
	);
	if (resolved?._tag === "Resolved")
		return {
			_tag: "Regenerated",
			lemmaPath: resolved.lemmaPath,
			linked: resolved.linked,
			readingBlockId: resolved.readingBlockId,
			scrollPath: target.scrollPath,
		};
	const reasons = pendingReasons(resolutions);
	return {
		_tag: "Unresolved",
		reason:
			reasons.length > 0
				? `resolution left it pending: ${reasons.join("; ")}`
				: `Classify found no unit at "${target.text}"`,
	};
});

export type ExecuteOptions = {
	readonly vault: ResetVault;
	readonly dictionary: ResetDictionary;
	/** Names the backup folder and the report: `resetStamp(...)`. */
	readonly stamp: string;
	/** Completed to cancel the run. */
	readonly cancel: Cancellation;
	readonly onProgress?: (progress: ResetProgress) => void;
	/** What Classify's resolver told the user so far; read for the report. */
	readonly notices?: () => readonly string[];
};

/** Execute: back up, regenerate, re-attach, report. */
export const executeReset = Effect.fn("executeReset")(function* (
	options: ExecuteOptions,
): Effect.fn.Return<
	ExecuteResult,
	ResetFailed,
	ClassifySegmenter | SegmentationCache | UnitResolver
> {
	const { cancel, dictionary, vault } = options;
	const progress = (update: ResetProgress) =>
		Effect.sync(() => options.onProgress?.(update));

	yield* progress({ done: 0, stage: "Collect", total: 1 });
	const { collected, contents } = yield* collectWorter(vault);
	const plan = yield* planReset(vault, collected);
	const newFormat = collected.notes.filter(
		({ kind }) => kind === "NewFormat",
	);
	if (newFormat.length > 0)
		return yield* new ResetFailed({
			cause: newFormat.map(({ path }) => path),
			message: `${WORTER}/ already holds ${newFormat.length} note${newFormat.length === 1 ? "" : "s"} in the new format, such as ${newFormat[0]?.path}. The reset is for old notes only; nothing changed`,
		});

	if (yield* Deferred.isDone(cancel))
		return yield* new ResetFailed({
			cause: "cancelled",
			message:
				"The reset was cancelled before the backup; nothing changed",
		});
	yield* progress({ done: 0, stage: "Backup", total: 1 });
	const backupFolder = yield* freePath(
		vault,
		`${WORTER} backup ${options.stamp}`,
	);
	yield* checkUnchanged(vault, plan, contents);
	// VAM hides its own move from the store, so the store reads Worter/
	// again whatever the backup came to.
	const unplanned = yield* backUp(vault, plan, contents, backupFolder).pipe(
		Effect.tapError(() => Effect.ignore(dictionary.rescan)),
	);
	const rescanned = yield* Effect.result(dictionary.rescan);
	const notices: string[] = [];
	if (unplanned.length > 0)
		notices.push(
			`Files that reached ${WORTER}/ after the reset read it are kept in the backup, unread: ${unplanned.join(", ")}`,
		);

	const regenerations: (RegenerationResult | undefined)[] =
		plan.attestations.map(() => undefined);
	const ready = plan.attestations.flatMap((planned, index) =>
		planned.outcome._tag === "Ready" ? [index] : [],
	);
	let cancelled = false;
	for (const [position, index] of ready.entries()) {
		const planned = plan.attestations[index];
		if (!planned) continue;
		if (rescanned._tag === "Failure") {
			// A store that could not read Worter/ again must not commit.
			regenerations[index] = {
				_tag: "Unresolved",
				reason: `the dictionary could not read ${WORTER}/ after the backup: ${rescanned.failure.message}`,
			};
			continue;
		}
		if (cancelled || (yield* Deferred.isDone(cancel))) {
			cancelled = true;
			regenerations[index] = { _tag: "Cancelled" };
			continue;
		}
		yield* progress({
			done: position,
			label: planned.headword,
			stage: "Regenerate",
			total: ready.length,
		});
		// Classify itself runs to its end, so what it committed is known and
		// reported; the wait for its Knowledge stops at once on cancel.
		regenerations[index] = yield* regenerateOne(
			vault,
			plan,
			index,
			backupFolder,
		);
		const settled = yield* unlessCancelled(
			cancel,
			dictionary.settleKnowledge,
		);
		if (Option.isNone(settled)) cancelled = true;
	}
	for (const [index, planned] of plan.attestations.entries())
		if (planned.outcome._tag === "Duplicate")
			regenerations[index] = regenerations[planned.outcome.of];

	yield* progress({
		done: 0,
		stage: "Reattach",
		total: plan.freeform.length,
	});
	const regenerated = plan.attestations.flatMap((planned, index) => {
		const result = regenerations[index];
		return result?._tag === "Regenerated" ? [{ planned, result }] : [];
	});
	const freeform: FreeformResult[] = [];
	for (const planned of plan.freeform) {
		if (planned.outcome._tag === "Unplaceable") {
			freeform.push({ _tag: "Unplaced", reason: planned.outcome.reason });
			continue;
		}
		const key = headwordKey(planned.headword);
		const target =
			regenerated.find(
				({ planned: from }) => from.notePath === planned.notePath,
			) ??
			regenerated.find(
				({ planned: from }) => headwordKey(from.headword) === key,
			);
		if (!target) {
			freeform.push({
				_tag: "Unplaced",
				reason: cancelled
					? `the reset was cancelled before "${planned.headword}" was regenerated`
					: `no Lemma was regenerated for "${planned.headword}"`,
			});
			continue;
		}
		const appended = yield* dictionary
			.appendFreeform({
				path: target.result.lemmaPath,
				readingBlockId: target.result.readingBlockId,
				text: planned.block.text,
			})
			.pipe(
				Effect.map(
					(outcome): FreeformResult =>
						outcome === "Appended"
							? {
									_tag: "Attached",
									lemmaPath: target.result.lemmaPath,
								}
							: {
									_tag: "AlreadyThere",
									lemmaPath: target.result.lemmaPath,
								},
				),
				Effect.catchTag("ResetFailed", (error) =>
					Effect.succeed<FreeformResult>({
						_tag: "Unplaced",
						reason: error.message,
					}),
				),
			);
		freeform.push(appended);
	}

	yield* progress({ done: 0, stage: "Report", total: 1 });
	const execution: ResetExecution = {
		backupFolder,
		cancelled,
		freeform,
		notices: [...notices, ...(options.notices?.() ?? [])],
		regenerations,
	};
	const report = renderReport(plan, execution);
	// A report that cannot be written travels in the error, so the command
	// can still log it.
	const lost = (error: ResetFailed) =>
		new ResetFailed({
			cause: report,
			message: `The reset ran, but its report note could not be written (${error.message}); the report is in the developer console`,
		});
	const reportPath = yield* freePath(
		vault,
		`Dictionary reset ${options.stamp}`,
		".md",
	).pipe(Effect.mapError(lost));
	yield* vault.createNote(reportPath, report).pipe(Effect.mapError(lost));
	return { execution, plan, report, reportPath };
});
