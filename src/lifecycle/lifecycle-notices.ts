/**
 * What the plugin's lifecycle tells the user, and what it only logs, in one
 * place. Once the plugin unloads it tells nothing more.
 */
import { logError } from "@textfresser/vault-action-manager/issue-handlers";
import type { LibrarianStop } from "../commanders/librarian/librarian";
import type { DelimiterMigrationReport } from "../commanders/librarian/runtime/delimiter-migration-report";
import { getErrorMessage } from "../utils/get-error-message";
import { logger } from "../utils/logger";

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

export function createLifecycleNotices(show: ShowNotice) {
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
		delimiterMigrationReported: (report: DelimiterMigrationReport) => {
			if (report.notice) notify(report.notice, report.persistent);
			if (report.log) {
				logger.error(
					"[TextEaterPlugin] Delimiter migration did not complete:",
					report.log,
				);
			}
		},

		launchFailed: (error: unknown) => {
			logError({
				description: `Error during plugin initialization: ${getErrorMessage(error)}`,
				location: "TextEaterPlugin",
			});
		},

		librarianRestarted: () => notify("Librarian restarted"),

		/** A start or restart of the Librarian failed; its stop notice told why. */
		librarianStartFailed: (
			reason: LibrarianStartReason,
			error: unknown,
		) => {
			logger.error(
				reason === "Launch"
					? "[TextEaterPlugin] Failed to initialize librarian:"
					: "[TextEaterPlugin] Failed to reinitialize librarian:",
				getErrorMessage(error),
			);
		},

		librarianStopFailed: (error: unknown) => {
			logger.error(
				"[TextEaterPlugin] Failed to stop Librarian:",
				getErrorMessage(error),
			);
		},

		/**
		 * The Librarian stopped while it started for `starting`, or, when
		 * that is null, later on. A stop stays until dismissed. A missing
		 * Library folder is not a failure: it is only logged at launch, and
		 * a passing notice on a re-init. While a delimiter migration
		 * restarts it, its report quotes the stop instead, so nothing shows
		 * here.
		 */
		librarianStopped: (
			stop: LibrarianStop,
			starting: LibrarianStartReason | null,
		) => {
			if (starting === "DelimiterMigration") return;
			if (stop.kind === "Stopped") notify(stop.message, true);
			else if (starting !== "Launch") notify(stop.message);
		},

		/**
		 * Releasing part of the plugin as it unloads failed, such as
		 * `"dispose VaultActionManager"`; the rest still unloads.
		 */
		releaseFailed: (what: string, error: unknown) => {
			logger.error(
				`[TextEaterPlugin] Failed to ${what}:`,
				getErrorMessage(error),
			);
		},

		restartWaitsForMigration: () =>
			notify(
				"The suffix delimiter is still changing; the Librarian restarts once it is done",
			),

		stillLoading: () => notify("Textfresser is still loading"),

		storeBuildFailed: (error: unknown) => {
			logger.error(
				"[TextEaterPlugin] Failed to build the dictionary store:",
				getErrorMessage(error),
			);
		},

		/** The unlink sweep could not run: the dictionary store did not load. */
		sweepSkipped: (error: unknown) => {
			logger.warn(
				"[TextEaterPlugin] Skipped the unlink sweep: the dictionary store did not load:",
				getErrorMessage(error),
			);
		},
	};
}
