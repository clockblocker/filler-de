import { splitPathCodec } from "@textfresser/vault-action-manager";
import { Predicate } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import type {
	DelimiterActionFailure,
	DelimiterMigrationExecution,
} from "./delimiter-change-service";
import type { DelimiterMigrationOutcome } from "./delimiter-migration-coordinator";
import type { DelimiterRenameAction } from "./delimiter-migration-plan";
import {
	describeLibrarianStop,
	describeMissingLibraryRoot,
	isMissingLibraryRoot,
} from "./describe-librarian-stop";

export type DelimiterMigrationReport = {
	/** Whether the setting must keep the new delimiter: every note carries it. */
	readonly keepsNewDelimiter: boolean;
	/**
	 * Whether the migration already re-initialized the Librarian under the
	 * delimiter the setting keeps, or tried its one retry, so saving the
	 * settings must not re-initialize it again.
	 */
	readonly librarianReinitialized: boolean;
	/** Full details for the console, when the migration did not complete. */
	readonly log: string | null;
	readonly notice: string | null;
	/** Whether the notice stays until dismissed, because files need a hand. */
	readonly persistent: boolean;
};

const LISTED_FILES = 5;

/**
 * Whether every note carries the new delimiter but the Librarian failed to
 * restart under it, so the restart is worth one more try.
 */
export function needsLibrarianRestartRetry(
	outcome: DelimiterMigrationOutcome,
): boolean {
	return (
		outcome.kind === "Failed" &&
		outcome.problem.stage === "Restore" &&
		outcome.execution?.kind === "Completed"
	);
}

/**
 * Tells the user what a delimiter migration did to the vault and which
 * delimiter the setting now holds. `oldDelimiter` and `newDelimiter` are the
 * canonical delimiters, as the confirmation showed them.
 * `librarianRestartRetried` is whether the retry `needsLibrarianRestartRetry`
 * asks for restarted the Librarian; absent when there was none.
 */
export function reportDelimiterMigration(
	outcome: DelimiterMigrationOutcome,
	delimiters: {
		readonly newDelimiter: string;
		readonly oldDelimiter: string;
	},
	librarianRestartRetried?: boolean,
): DelimiterMigrationReport {
	const { newDelimiter, oldDelimiter } = delimiters;
	switch (outcome.kind) {
		case "Cancelled":
		case "NoOp":
			return report(outcome.kind === "NoOp", null, null, false);
		case "Completed":
			return Object.freeze({
				...report(
					true,
					`Renamed ${outcome.renamedCount} file(s) to use "${newDelimiter}".`,
					null,
					false,
				),
				librarianReinitialized: true,
			});
		case "RollbackIncomplete":
			return report(
				false,
				`${describeExecution(outcome.execution, delimiters)} Kept the delimiter "${oldDelimiter}"; rename the files listed by hand.`,
				describeLog(outcome),
				true,
			);
		case "Failed":
			return reportFailure(outcome, delimiters, librarianRestartRetried);
	}
}

function reportFailure(
	outcome: Extract<DelimiterMigrationOutcome, { kind: "Failed" }>,
	delimiters: {
		readonly newDelimiter: string;
		readonly oldDelimiter: string;
	},
	librarianRestartRetried: boolean | undefined,
): DelimiterMigrationReport {
	const { newDelimiter, oldDelimiter } = delimiters;
	const { execution, problem } = outcome;
	const reason = describeDelimiterMigrationCause(problem.cause);
	const log = describeLog(outcome);

	if (problem.stage !== "Restore") {
		if (execution && execution.kind !== "Completed") {
			return report(
				false,
				`${describeExecution(execution, delimiters)} Kept the delimiter "${oldDelimiter}".`,
				log,
				false,
			);
		}
		return report(
			false,
			problem.stage === "Dispatch"
				? `Delimiter change failed: ${reason}. Kept the delimiter "${oldDelimiter}"; check the Library for files that use "${newDelimiter}".`
				: `Delimiter change failed before any file was renamed: ${reason}. Kept the delimiter "${oldDelimiter}".`,
			log,
			problem.stage === "Dispatch",
		);
	}

	// The Librarian's own stop notice is held back during the migration;
	// this notice tells the user why it stopped and how to restart it.
	const stopped = describeRestartFailure(problem.cause);
	if (!execution) {
		return report(
			false,
			`No file was renamed and the delimiter "${oldDelimiter}" is kept, but the Librarian did not restart. ${stopped}`,
			log,
			true,
		);
	}
	if (execution.kind === "Completed") {
		const renamed = `Renamed ${execution.renamedCount} file(s) to use "${newDelimiter}"`;
		if (librarianRestartRetried === true) {
			return Object.freeze({
				...report(true, `${renamed}.`, log, false),
				librarianReinitialized: true,
			});
		}
		return Object.freeze({
			...report(
				true,
				`${renamed} and kept that delimiter, but the Librarian did not restart. ${stopped}`,
				log,
				true,
			),
			librarianReinitialized: librarianRestartRetried === false,
		});
	}
	return report(
		false,
		`${describeExecution(execution, delimiters)} Kept the delimiter "${oldDelimiter}"${execution.kind === "RollbackIncomplete" ? "; rename the files listed by hand" : ""}. The Librarian did not restart. ${stopped}`,
		log,
		true,
	);
}

/** Why the Librarian did not restart, as its own stop notice would say. */
function describeRestartFailure(cause: unknown): string {
	return isMissingLibraryRoot(cause)
		? describeMissingLibraryRoot(cause)
		: describeLibrarianStop("Startup", cause);
}

/** One account of a failed execution: the failure, then the files' state. */
function describeExecution(
	execution: Exclude<DelimiterMigrationExecution, { kind: "Completed" }>,
	{
		newDelimiter,
		oldDelimiter,
	}: { readonly newDelimiter: string; readonly oldDelimiter: string },
): string {
	const failed = `Delimiter change failed: ${describeFailure(execution.failure)}.`;
	const back = execution.rolledBack.length;
	if (execution.kind === "RolledBack") {
		return back === 0
			? `${failed} No file was renamed.`
			: `${failed} Renamed the ${back} file(s) already changed back to "${oldDelimiter}".`;
	}

	const parts = [failed];
	if (back > 0)
		parts.push(`Renamed ${back} file(s) back to "${oldDelimiter}".`);
	if (execution.leftRenamed.length > 0) {
		parts.push(
			`Could not rename these back, so they still use "${newDelimiter}": ${listFiles(
				execution.leftRenamed.map((action) =>
					splitPathCodec.format(action.payload.to),
				),
			)}.`,
		);
	}
	if (execution.unresolved.length > 0) {
		parts.push(
			`Could not tell whether these were renamed: ${listFiles(
				execution.unresolved.map(renamePath),
			)}.`,
		);
	}
	return parts.join(" ");
}

function describeFailure(failure: DelimiterActionFailure): string {
	const reason = rootMessage(failure.cause);
	return failure.path
		? `could not rename ${failure.path} (${reason})`
		: `${failure.operation} failed (${reason})`;
}

function describeLog(outcome: DelimiterMigrationOutcome): string {
	const lines: string[] = [];
	if (outcome.kind === "Failed") {
		lines.push(
			`${outcome.problem.stage}/${outcome.problem.operation}: ${describeDelimiterMigrationCause(outcome.problem.cause)}`,
		);
	}
	for (const failure of "failures" in outcome ? outcome.failures : []) {
		lines.push(
			`${failure.operation}${failure.path ? ` ${failure.path}` : ""}: ${getErrorMessage(failure.cause)}`,
		);
	}
	const execution = "execution" in outcome ? outcome.execution : undefined;
	if (execution && execution.kind !== "Completed") {
		if (execution.rolledBack.length > 0) {
			lines.push(
				`renamed back: ${execution.rolledBack.map(renamePath).join(", ")}`,
			);
		}
		if (execution.kind === "RollbackIncomplete") {
			if (execution.leftRenamed.length > 0) {
				lines.push(
					`still renamed: ${execution.leftRenamed.map(renamePath).join(", ")}`,
				);
			}
			if (execution.unresolved.length > 0) {
				lines.push(
					`state unknown: ${execution.unresolved.map(renamePath).join(", ")}`,
				);
			}
		}
	}
	return lines.join("; ");
}

/**
 * The message of the innermost error, which names the real reason. VAM wraps
 * it in layers that repeat the paths; the console gets the full message.
 */
function rootMessage(cause: unknown): string {
	let current = cause;
	for (let depth = 0; depth < 10; depth += 1) {
		if (!Predicate.hasProperty(current, "cause")) break;
		const inner = current.cause;
		if (!(inner instanceof Error)) break;
		current = inner;
	}
	return getErrorMessage(current);
}

function listFiles(paths: readonly string[]): string {
	const listed = paths.slice(0, LISTED_FILES).join(", ");
	const more = paths.length - LISTED_FILES;
	return more > 0 ? `${listed}, and ${more} more (see the console)` : listed;
}

function renamePath(action: DelimiterRenameAction): string {
	return `${splitPathCodec.format(action.payload.from)} → ${splitPathCodec.format(action.payload.to)}`;
}

function report(
	keepsNewDelimiter: boolean,
	notice: string | null,
	log: string | null,
	persistent: boolean,
): DelimiterMigrationReport {
	return Object.freeze({
		keepsNewDelimiter,
		librarianReinitialized: false,
		log,
		notice,
		persistent,
	});
}

/** Describes a migration problem's cause, including a scan's diagnostics list. */
function describeDelimiterMigrationCause(cause: unknown): string {
	if (!Array.isArray(cause)) return getErrorMessage(cause);
	return cause
		.map((item) => {
			const operation =
				Predicate.hasProperty(item, "operation") &&
				Predicate.isString(item.operation)
					? item.operation
					: "scan";
			const path =
				Predicate.hasProperty(item, "path") &&
				Predicate.isString(item.path)
					? ` ${item.path}`
					: "";
			const itemCause = Predicate.hasProperty(item, "cause")
				? item.cause
				: item;
			return `${operation}${path}: ${getErrorMessage(itemCause)}`;
		})
		.join(", ");
}
