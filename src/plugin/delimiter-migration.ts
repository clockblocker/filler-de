/**
 * A change of the suffix delimiter in settings: renames the Library's files
 * for the new delimiter with the Librarian paused, and tells the user what
 * happened to the files and to the setting. The coordinator owns planning,
 * confirmation, dispatch, rollback and restoration; this wires it to the
 * lifecycle supervisor.
 */
import {
	SplitPathKind,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Cause, Data, Effect } from "effect";
import type { DelimiterChangeService } from "../commanders/librarian/runtime/delimiter-change-service";
import {
	DelimiterMigrationCoordinator,
	type DelimiterMigrationOutcome,
} from "../commanders/librarian/runtime/delimiter-migration-coordinator";
import {
	type DelimiterMigrationReport,
	needsLibrarianRestartRetry,
	reportDelimiterMigration,
} from "../commanders/librarian/runtime/delimiter-migration-report";
import type { LifecycleNotices } from "../lifecycle/lifecycle-notices";
import type {
	LibrarianStartFailed,
	LifecycleStoppedError,
	LifecycleSupervisor,
	ReleaseFailed,
	SupervisedLibrarian,
} from "../lifecycle/lifecycle-supervisor";
import type { SuffixDelimiterConfig } from "../types";
import { buildCanonicalDelimiter } from "../utils/delimiter";

/** The migration could not begin, such as for a Library root that is no folder. */
export class DelimiterMigrationUnavailable extends Data.TaggedError(
	"DelimiterMigrationUnavailable",
)<{ readonly message: string }> {}

/** What the migration's lifecycle, around its plan and renames, fails with. */
export type DelimiterLifecycleFailure =
	| DelimiterMigrationUnavailable
	| LibrarianStartFailed
	| LifecycleStoppedError
	| ReleaseFailed;

export type DelimiterMigrationDeps = {
	readonly supervisor: Pick<
		LifecycleSupervisor<SupervisedLibrarian>,
		"duringMigration" | "pause" | "resume"
	>;
	readonly service: DelimiterChangeService;
	readonly libraryRoot: string;
	/** Asks the user before the renames: `Confirm.ask`. */
	readonly confirm: (
		title: string,
		message: string,
	) => Effect.Effect<boolean>;
	/** Puts `config` into the settings in effect. */
	readonly applyDelimiter: (
		config: SuffixDelimiterConfig,
	) => Effect.Effect<void>;
	readonly notices: LifecycleNotices;
};

export function changeDelimiter(
	deps: DelimiterMigrationDeps,
	oldConfig: SuffixDelimiterConfig,
	newConfig: SuffixDelimiterConfig,
): Effect.Effect<DelimiterMigrationReport> {
	const delimiters = {
		newDelimiter: buildCanonicalDelimiter(newConfig),
		oldDelimiter: buildCanonicalDelimiter(oldConfig),
	};
	return Effect.gen(function* () {
		const outcome = yield* migrate(deps, oldConfig, newConfig, delimiters);
		// Every file carries the new delimiter, but the Librarian did not
		// start under it: try once more.
		const retried = needsLibrarianRestartRetry(outcome)
			? yield* deps.supervisor.resume.pipe(
					Effect.as(true),
					Effect.orElseSucceed(() => false),
				)
			: undefined;
		return reportDelimiterMigration(outcome, delimiters, retried);
	}).pipe(
		deps.supervisor.duringMigration,
		Effect.catchTag("LifecycleStoppedError", (stopped) =>
			Effect.succeed(
				reportDelimiterMigration(
					failedBeforePlanning(
						"delimiterMigration.lifecycle",
						Cause.fail(stopped),
					),
					delimiters,
				),
			),
		),
		Effect.tap(deps.notices.delimiterMigrationReported),
	);
}

function migrate(
	deps: DelimiterMigrationDeps,
	oldConfig: SuffixDelimiterConfig,
	newConfig: SuffixDelimiterConfig,
	delimiters: {
		readonly newDelimiter: string;
		readonly oldDelimiter: string;
	},
): Effect.Effect<DelimiterMigrationOutcome<DelimiterLifecycleFailure>> {
	const libraryRoot = splitPathCodec.parse(deps.libraryRoot);
	if (libraryRoot.kind !== SplitPathKind.Folder) {
		return Effect.succeed(
			failedBeforePlanning(
				"delimiterMigration.parseLibraryRoot",
				Cause.fail(
					new DelimiterMigrationUnavailable({
						message: `Library root "${deps.libraryRoot}" is not a folder path`,
					}),
				),
			),
		);
	}
	const coordinator =
		new DelimiterMigrationCoordinator<DelimiterLifecycleFailure>(
			deps.service,
			{
				confirm: (plan) =>
					deps.confirm(
						"Rename files?",
						`Changing suffix delimiter from "${delimiters.oldDelimiter}" to "${delimiters.newDelimiter}" will rename ${plan.previewCount} file(s). Continue?`,
					),
				pause: () => deps.supervisor.pause("DelimiterMigration"),
				// The supervisor knows whether the Librarian is paused, so it
				// unsubscribes the current one only when it still runs.
				restore: (config) =>
					deps
						.applyDelimiter(config)
						.pipe(Effect.andThen(deps.supervisor.resume)),
			},
		);
	return coordinator.migrate(oldConfig, newConfig, libraryRoot);
}

function failedBeforePlanning(
	operation: string,
	cause: Cause.Cause<DelimiterLifecycleFailure>,
): DelimiterMigrationOutcome<DelimiterLifecycleFailure> {
	return {
		failures: [],
		kind: "Failed",
		problem: { cause, operation, stage: "Planning" },
	};
}
