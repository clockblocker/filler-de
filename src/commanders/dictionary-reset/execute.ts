/**
 * "Reset dictionary from old notes…" (#65, #117): one pipeline in two modes,
 * over one source folder of old notes, `Worter/` or a `Worter backup …`
 * folder (`source.ts`).
 *
 * - **Dry run**: Collect and plan, then the report. It reads only: no
 *   backup, no write, no provider call.
 * - **Execute**: Collect and plan; move `Worter/`, whatever it holds, to a
 *   new dated backup folder and check every file arrived there; regenerate
 *   each attestation by running Classify over its Segment, through the same
 *   `UnitResolver` and dictionary store as the command, into Lemma, Reading
 *   and Crossroad notes; re-attach each freeform Block to the Reading note
 *   of its sense (`freeform-target.ts`); write the report note.
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
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Deferred, Effect, Option } from "effect";
import {
	type ClassifyError,
	type ClassifySegmenter,
	classifySelection,
} from "../classify/classify-selection";
import type { SegmentationCache } from "../classify/segmentation-cache";
import type { UnitResolver } from "../classify/unit-resolver";
import { freeformTarget } from "./freeform-target";
import { layoutOf, type ResetLayout } from "./layout";
import {
	type Collected,
	collectOldNotes,
	headwordKey,
	planReset,
	type ResetPlan,
	targetAttestation,
	WORTER,
} from "./plan";
import { type ResetDictionary, ResetFailed, type ResetVault } from "./ports";
import {
	type FreeformResult,
	type RegenerationResult,
	type ResetExecution,
	renderReport,
} from "./report";
import { chooseSource, isOldNote } from "./source";

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

/** A folder as Collect read it. */
type ReadFolder = {
	readonly folder: string;
	readonly collected: Collected;
	/** Each note's content as Collect read it, by path. */
	readonly contents: ReadonlyMap<string, string>;
};

const readFolder = Effect.fnUntraced(function* (
	vault: ResetVault,
	folder: string,
): Effect.fn.Return<ReadFolder | undefined, ResetFailed> {
	const listed = yield* vault.listFolder(folder);
	if (!listed) return undefined;
	return {
		collected: collectOldNotes(listed.markdown, listed.other),
		contents: new Map(
			listed.markdown.map(({ content, path }) => [path, content]),
		),
		folder,
	};
});

const isEmpty = ({ collected }: ReadFolder) =>
	collected.notes.length === 0 && collected.otherFiles.length === 0;

/**
 * Collect: every note in the source folder, read, and `Worter/` as it is
 * now, which is the source itself when the source is `Worter/`.
 */
const collect = Effect.fnUntraced(function* (
	vault: ResetVault,
	requested: string | undefined,
) {
	const folder = yield* chooseSource(vault, requested);
	const source = yield* readFolder(vault, folder);
	if (!source)
		return yield* new ResetFailed({
			cause: folder,
			message: `There is no ${folder}/ folder to reset from`,
		});
	if (!source.collected.notes.some(isOldNote))
		return yield* new ResetFailed({
			cause: folder,
			message: `${folder}/ holds no old notes, so there is nothing to regenerate from it${folder === WORTER ? `; choose a "${WORTER} backup <date time>" folder that holds them as the source` : ""}`,
		});
	const worter =
		folder === WORTER ? source : yield* readFolder(vault, WORTER);
	const plan = yield* planReset(vault, {
		collected: source.collected,
		source: folder,
		...(folder !== WORTER && worter !== undefined
			? { current: worter.collected }
			: {}),
	});
	return { plan, source, worter };
});

export type ResetOptions = {
	/** The folder of old notes, as `findSources` lists it; the suggestion when absent. */
	readonly source?: string;
};

/** Dry run: Collect, plan and report, reading only. */
export const dryRunReset = Effect.fn("dryRunReset")(function* (
	vault: ResetVault,
	options: ResetOptions = {},
): Effect.fn.Return<DryRunResult, ResetFailed> {
	const { plan } = yield* collect(vault, options.source);
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
 * Reads a folder again right before the move, so an edit since Collect
 * stops the reset while nothing has moved yet.
 */
const checkUnchanged = Effect.fnUntraced(function* (
	vault: ResetVault,
	read: ReadFolder,
): Effect.fn.Return<void, ResetFailed> {
	const now = yield* vault.listFolder(read.folder);
	const unchanged =
		now !== undefined &&
		now.markdown.length === read.contents.size &&
		now.markdown.every(
			({ content, path }) => read.contents.get(path) === content,
		) &&
		now.other.length === read.collected.otherFiles.length;
	if (!unchanged)
		return yield* new ResetFailed({
			cause: read.folder,
			message: `${read.folder}/ changed while the reset read it. Nothing was moved; run the reset again`,
		});
});

/**
 * Moves `Worter/`, old or obsolete notes alike, to the backup folder, then
 * checks the move: `Worter/` is gone and every file Collect read sits in
 * the backup with the content it read. Anything else stops the reset
 * before it writes anything more. It answers the backup's files that
 * Collect never read.
 */
const backUp = Effect.fnUntraced(function* (
	vault: ResetVault,
	worter: ReadFolder,
	backupFolder: string,
): Effect.fn.Return<readonly string[], ResetFailed> {
	const { collected, contents } = worter;
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
	for (const note of collected.notes) {
		const content = backedUp.get(relocate(note.path));
		if (content === undefined || content !== contents.get(note.path))
			return yield* stop(
				`${relocate(note.path)} is not in the backup as it was read`,
			);
	}
	for (const path of collected.otherFiles)
		if (!otherFiles.has(relocate(path)))
			return yield* stop(`${relocate(path)} is not in the backup`);
	// Files that arrived between the last read and the move: kept in the
	// backup, never read, and named in the report.
	const planned = new Set([
		...collected.notes.map(({ path }) => relocate(path)),
		...collected.otherFiles.map(relocate),
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
	protectedFolders: readonly string[],
): Effect.fn.Return<
	RegenerationResult,
	never,
	ClassifySegmenter | SegmentationCache | UnitResolver
> {
	const planned = plan.attestations[index];
	if (!planned) return { _tag: "Unresolved", reason: "it is not planned" };
	// The source is read again, as it is now, not as the plan read it.
	const target = yield* targetAttestation(
		vault,
		{ forms: planned.forms, path: planned.notePath },
		planned.attestation,
		protectedFolders,
	);
	if (target._tag === "Unresolvable")
		return { _tag: "Unresolved", reason: target.reason };
	// The old notes' links at the occurrence, such as `Der [[Fahrer]]`,
	// predate the dictionary's layout, so the link to the Reading replaces
	// them (#148).
	const outcome = yield* classifySelection({
		content: target.content,
		scrollPath: target.scrollPath,
		selection: target.selection,
		userLinks: "Replace",
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
						reason: `Classify failed unexpectedly: ${formatCause(cause, { stack: false })}`,
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
			readingPath: resolved.readingPath,
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
	/** The folder of old notes the user chose: `Worter` or a backup folder. */
	readonly source: string;
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
	const { plan, source, worter } = yield* collect(vault, options.source);
	const newFormat = (worter?.collected.notes ?? []).filter(
		({ kind }) => kind === "NewFormat",
	);
	if (newFormat.length > 0)
		return yield* new ResetFailed({
			cause: newFormat.map(({ path }) => path),
			message: `${WORTER}/ already holds ${newFormat.length} note${newFormat.length === 1 ? "" : "s"} of the current layout, such as ${newFormat[0]?.path}. The reset regenerates into a fresh ${WORTER}/ only; nothing changed`,
		});

	if (yield* Deferred.isDone(cancel))
		return yield* new ResetFailed({
			cause: "cancelled",
			message:
				"The reset was cancelled before the backup; nothing changed",
		});
	yield* progress({ done: 0, stage: "Backup", total: 1 });
	const toMove =
		worter !== undefined && !isEmpty(worter) ? worter : undefined;
	const backupFolder =
		toMove === undefined
			? undefined
			: yield* freePath(vault, `${WORTER} backup ${options.stamp}`);
	yield* checkUnchanged(vault, source);
	if (toMove !== undefined && toMove !== source)
		yield* checkUnchanged(vault, toMove);
	const unplanned =
		toMove === undefined || backupFolder === undefined
			? []
			: yield* backUp(vault, toMove, backupFolder).pipe(
					// A backup that stopped part way may still have moved
					// notes: the store has followed them before the reset
					// reports the failure.
					Effect.tapError(() => Effect.ignore(dictionary.caughtUp)),
				);
	// The store hears the backup's move as an event; regeneration waits
	// until it has followed it, so no commit plans against the old notes.
	const caughtUp = yield* Effect.result(dictionary.caughtUp);
	const notices: string[] = [];
	if (unplanned.length > 0)
		notices.push(
			`Files that reached ${WORTER}/ after the reset read it are kept in the backup, unread: ${unplanned.join(", ")}`,
		);
	// Classify writes into the Scroll it classifies, and none of these may be one.
	const protectedFolders = [
		...new Set([
			WORTER,
			plan.source,
			...(backupFolder === undefined ? [] : [backupFolder]),
		]),
	];

	const regenerations: (RegenerationResult | undefined)[] =
		plan.attestations.map(() => undefined);
	const ready = plan.attestations.flatMap((planned, index) =>
		planned.outcome._tag === "Ready" ? [index] : [],
	);
	let cancelled = false;
	for (const [position, index] of ready.entries()) {
		const planned = plan.attestations[index];
		if (!planned) continue;
		if (caughtUp._tag === "Failure") {
			// A store that could not be opened must not commit.
			regenerations[index] = {
				_tag: "Unresolved",
				reason: `the dictionary could not follow the backup of ${WORTER}/: ${caughtUp.failure.message}`,
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
			protectedFolders,
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
		const candidates = regenerated.flatMap(({ planned: from, result }) =>
			from.notePath === planned.notePath ||
			headwordKey(from.headword) === key
				? [result]
				: [],
		);
		const target = freeformTarget(planned.block.emojis, candidates);
		if (target._tag === "None") {
			freeform.push({
				_tag: "Unplaced",
				reason:
					candidates.length > 0
						? `${target.reason}, so neither its Reading nor its Lemma is known`
						: cancelled
							? `the reset was cancelled before "${planned.headword}" was regenerated`
							: `no Lemma was regenerated for "${planned.headword}"`,
			});
			continue;
		}
		const to = target._tag;
		const appended = yield* dictionary
			.appendFreeform({ path: target.path, text: planned.block.text })
			.pipe(
				Effect.map(
					(outcome): FreeformResult => ({
						_tag:
							outcome === "Appended"
								? "Attached"
								: "AlreadyThere",
						path: target.path,
						to,
					}),
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

	// What Worter/ holds now, read from the files: the report's layout.
	const layout = yield* vault.listFolder(WORTER).pipe(
		Effect.map((listed): ResetLayout | undefined =>
			layoutOf(listed?.markdown ?? []),
		),
		Effect.orElseSucceed(() => undefined),
	);
	if (layout && layout.shadowNotes.length > 0)
		notices.push(
			`⚠ ${WORTER}/ holds ${layout.shadowNotes.length} Shadow note${layout.shadowNotes.length === 1 ? "" : "s"}, which the dictionary should never write`,
		);

	yield* progress({ done: 0, stage: "Report", total: 1 });
	const execution: ResetExecution = {
		backupFolder,
		cancelled,
		freeform,
		layout,
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
