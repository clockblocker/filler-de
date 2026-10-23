/**
 * What the plugin's lifecycle tells the user, and what it only logs, in one
 * place. Once the plugin unloads it tells nothing more.
 */
import {
	describeError,
	type RecentTrace,
} from "@textfresser/vault-action-manager/diagnostics";
import { formatError } from "@textfresser/vault-action-manager/issue-handlers";
import { Cause, Effect } from "effect";
import type {
	LibrarianStop,
	LibrarianUnsubscribeFailure,
} from "../commanders/librarian/librarian";
import type { DelimiterMigrationReport } from "../commanders/librarian/runtime/delimiter-migration-report";
import { logAtEdge } from "../runtime/edge-log";
import { causeValues } from "../utils/causes";
import { recentTrace } from "../utils/recent-trace";
import {
	BootFailed,
	type LibrarianStartFailed,
	type ReleaseFailed,
} from "./lifecycle-errors";

/** How many recent spans and log entries a Librarian stop writes out. */
const STOP_TRACE_ENTRIES = 300;

/** Not a log: the trace it writes would record itself. */
const writeToConsole = (_text: string) => {};

/** Shows `message`; a sticky one stays until the user dismisses it. */
export type ShowNotice = (
	message: string,
	options: { readonly sticky: boolean },
) => void;

/** Why the Librarian is (re)starting: it decides what its failure tells. */
export type LibrarianStartReason =
	| "Launch"
	| "Settings"
	| "RestartCommand"
	| "DelimiterMigration";

export type LifecycleNotices = ReturnType<typeof createLifecycleNotices>;

/**
 * What `onload` threw, or the cause a runtime build failed with, as a
 * cause, so the log keeps it whole: a `Cause` as it is.
 */
const asCause = (error: unknown): Cause.Cause<unknown> =>
	Cause.isCause(error) ? error : Cause.fail(error);

const launchFailedMessage = (failures: readonly unknown[]) => ({
	description: `Error during plugin initialization: ${failures
		.map((failure) => describeError(failure, { stack: false }))
		.join("; ")}`,
	location: "TextEaterPlugin",
});

/** Each failure and defect of a launch; a failed boot reads as what failed it. */
const launchFailures = (cause: Cause.Cause<BootFailed>): unknown[] =>
	causeValues(cause).flatMap((failure) =>
		failure instanceof BootFailed ? causeValues(failure.cause) : [failure],
	);

/**
 * A Librarian stop hands its message and the recent `trace` to `writeStop`,
 * the console unless a test silences it.
 */
export function createLifecycleNotices(
	show: ShowNotice,
	{
		trace = recentTrace,
		writeStop = writeToConsole,
	}: {
		readonly trace?: Pick<RecentTrace, "render">;
		readonly writeStop?: (text: string) => void;
	} = {},
) {
	let closed = false;
	const notify = (message: string, sticky = false) => {
		if (!closed) show(message, { sticky });
	};

	return {
		alreadyRestarting: () => notify("The Librarian is already restarting"),
		/** The plugin unloads: nothing is shown from here on. */
		close: () => {
			closed = true;
		},

		/** What a delimiter migration did to the files and to the setting. */
		delimiterMigrationReported: (report: DelimiterMigrationReport) =>
			Effect.gen(function* () {
				if (report.notice) notify(report.notice, report.persistent);
				if (report.log)
					yield* Effect.logError(
						"[TextEaterPlugin] Delimiter migration did not complete:",
						report.log,
					);
			}),

		/** The launch failed: a Notice tells it, and the log keeps its cause. */
		launchFailed: (cause: Cause.Cause<BootFailed>) =>
			Effect.suspend(() => {
				const message = formatError(
					launchFailedMessage(launchFailures(cause)),
				);
				show(message, { sticky: false });
				return Effect.logError(message, cause);
			}),

		/**
		 * `launchFailed` where no Effect runs: `onload` threw, or the
		 * plugin runtime could not be built, so there is none to log on.
		 */
		launchFailedOutsideRuntime: (error: unknown) => {
			const message = formatError(launchFailedMessage([error]));
			show(message, { sticky: false });
			logAtEdge("Error", message, asCause(error));
		},

		librarianRestarted: () => notify("Librarian restarted"),

		/**
		 * A start or restart of the Librarian failed, or unsubscribing the
		 * one before it did; its stop notice told why.
		 */
		librarianStartFailed: (
			reason: LibrarianStartReason,
			failure: LibrarianStartFailed | ReleaseFailed,
		) =>
			Effect.logError(
				reason === "Launch"
					? "[TextEaterPlugin] Failed to initialize librarian:"
					: "[TextEaterPlugin] Failed to reinitialize librarian:",
				Cause.fail(failure),
			),

		librarianStopFailed: (
			cause: Cause.Cause<LibrarianUnsubscribeFailure>,
		) =>
			Effect.logError(
				"[TextEaterPlugin] Failed to stop Librarian:",
				cause,
			),

		/**
		 * The Librarian stopped while it started for `starting`, or, when
		 * that is null, later on. A stop stays until dismissed. A missing
		 * Library folder is not a failure: it is only logged at launch, and
		 * a passing notice on a re-init. While a delimiter migration
		 * restarts it, its report quotes the stop instead, so nothing shows
		 * here. A stop writes the recent trace to the console either way.
		 */
		librarianStopped: (
			stop: LibrarianStop,
			starting: LibrarianStartReason | null,
		) => {
			if (stop._tag === "LibrarianStopped")
				writeStop(
					`[TextEaterPlugin] The Librarian stopped: ${stop.message}\n${trace.render({ last: STOP_TRACE_ENTRIES })}`,
				);
			if (starting === "DelimiterMigration") return;
			if (stop._tag === "LibrarianStopped") notify(stop.message, true);
			else if (starting !== "Launch") notify(stop.message);
		},

		/**
		 * Releasing part of the plugin as it unloads failed, such as
		 * `"dispose VaultActionManager"`; the rest still unloads.
		 */
		releaseFailed: ({ cause, what }: ReleaseFailed) =>
			Effect.logError(`[TextEaterPlugin] Failed to ${what}:`, cause),

		restartWaitsForMigration: () =>
			notify(
				"The suffix delimiter is still changing; the Librarian restarts once it is done",
			),

		stillLoading: () => notify("Textfresser is still loading"),

		storeBuildFailed: <E>(cause: Cause.Cause<E>) =>
			Effect.logError(
				"[TextEaterPlugin] Failed to build the dictionary store:",
				cause,
			),

		/** The unlink sweep could not run: the dictionary store did not load. */
		sweepSkipped: <E>(cause: Cause.Cause<E>) =>
			Effect.logWarning(
				"[TextEaterPlugin] Skipped the unlink sweep: the dictionary store did not load:",
				cause,
			),
	};
}
