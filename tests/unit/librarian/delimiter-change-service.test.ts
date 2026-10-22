import { describe, expect, test } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamDispatchError,
	VamDispatchStoppedError,
	VamPlanningError,
	VamProtectedPathError,
	VamScanError,
	type VaultAction,
	VaultActionKind,
	VaultPath,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	DelimiterChangeService,
	type DelimiterMigrationVam,
	DelimiterRenameConflictError,
} from "../../../src/commanders/librarian/runtime/delimiter-change-service";
import {
	DelimiterMigrationCoordinator,
	type DelimiterMigrationLifecycle,
} from "../../../src/commanders/librarian/runtime/delimiter-migration-coordinator";
import {
	type DelimiterMigrationPlan,
	planDelimiterMigration,
} from "../../../src/commanders/librarian/runtime/delimiter-migration-plan";
import {
	needsLibrarianRestartRetry,
	reportDelimiterMigration,
} from "../../../src/commanders/librarian/runtime/delimiter-migration-report";
import type { SuffixDelimiterConfig } from "../../../src/types";

const oldConfig = { padded: false, symbol: "-" } satisfies SuffixDelimiterConfig;
const newConfig = { padded: true, symbol: "~" } satisfies SuffixDelimiterConfig;
const delimiters = { newDelimiter: " ~ ", oldDelimiter: "-" } as const;
const root: SplitPathToFolder = {
	basename: "Library",
	kind: SplitPathKind.Folder,
	pathParts: [],
};

describe("delimiter migration planner", () => {
	test("returns an immutable no-op for identical canonical delimiters", () => {
		const plan = planDelimiterMigration({
			candidates: [mdPath("alpha-beta")],
			libraryRoot: root,
			newConfig: oldConfig,
			oldConfig,
		});

		expect(plan.kind).toBe("NoOp");
		expect(plan.actions).toEqual([]);
		expect(Object.isFrozen(plan)).toBe(true);
		expect(Object.isFrozen(plan.actions)).toBe(true);
	});

	test("replaces flexible old delimiters and applies the new padding", () => {
		const plan = planDelimiterMigration({
			candidates: [mdPath("alpha - beta")],
			libraryRoot: root,
			newConfig,
			oldConfig,
		});

		expect(plan.kind).toBe("Ready");
		expect(plan.previewCount).toBe(1);
		expect(plan.actions[0]?.payload.to.basename).toBe("alpha ~ beta");
	});

	test("escapes the future symbol even when the old delimiter is absent", () => {
		const plan = planDelimiterMigration({
			candidates: [mdPath("alpha~beta")],
			libraryRoot: root,
			newConfig,
			oldConfig,
		});

		expect(plan.actions[0]?.payload.to.basename).toBe("alpha_beta");
	});

	test("excludes candidates outside the typed library root", () => {
		const plan = planDelimiterMigration({
			candidates: [mdPath("alpha-beta", ["Elsewhere"])],
			libraryRoot: root,
			newConfig,
			oldConfig,
		});

		expect(plan.actions).toEqual([]);
		expect(plan.previewCount).toBe(0);
	});
});

describe("delimiter migration lifecycle", () => {
	test("a canonical no-op does not scan or touch the lifecycle", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, { ...oldConfig }, root),
		);

		expect(outcome.kind).toBe("NoOp");
		expect(harness.scanCalls).toBe(0);
		expect(harness.confirmCalls).toBe(0);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.restoreCalls).toBe(0);
	});

	test("confirms and dispatches the exact same plan without rescanning", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		let confirmedPlan: DelimiterMigrationPlan | undefined;
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle({
				confirm: (plan) => {
					confirmedPlan = plan;
					return Effect.succeed(true);
				},
			}),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Completed");
		expect(harness.scanCalls).toBe(1);
		expect(harness.dispatchCalls).toBe(1);
		expect(harness.dispatchedActions).toBe(confirmedPlan?.actions);
		expect(harness.restoredConfigs).toEqual([newConfig]);
	});

	test("cancellation does not pause, dispatch, or restore", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle({ confirm: () => Effect.succeed(false) }),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Cancelled");
		expect(harness.pauseCalls).toBe(0);
		expect(harness.dispatchCalls).toBe(0);
		expect(harness.restoreCalls).toBe(0);
	});

	test("a zero-action change switches config without pausing or confirming", async () => {
		const harness = makeHarness([readableMdPath("alpha")]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, { padded: true, symbol: "-" }, root),
		);

		expect(outcome.kind).toBe("Completed");
		expect(harness.confirmCalls).toBe(0);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.dispatchCalls).toBe(0);
		expect(harness.restoredConfigs).toEqual([{ padded: true, symbol: "-" }]);
	});

	test("a failure partway renames the moved files back and keeps the old config", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
			readableMdPath("kappa-lambda"),
		]);
		harness.failForward = failOn("gamma-delta");
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.stage).toBe("Dispatch");
		expect(outcome.problem.operation).toBe("executeAction");
		expect(outcome.execution?.kind).toBe("RolledBack");
		if (outcome.execution?.kind !== "RolledBack") return;
		expect(outcome.execution.failure.path).toBe(
			"Library/gamma-delta.md → Library/gamma ~ delta.md",
		);
		expect(
			outcome.execution.rolledBack.map(
				(action) => action.payload.from.basename,
			),
		).toEqual(["alpha-beta"]);
		expect(harness.rollbackBatches).toHaveLength(1);
		expect(harness.rollbackBatches[0]).toEqual([
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdPath("alpha ~ beta"),
					to: mdPath("alpha-beta"),
				},
			},
		]);
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha-beta.md",
			"Library/gamma-delta.md",
			"Library/kappa-lambda.md",
		]);
		expect(harness.restoredConfigs).toEqual([oldConfig]);
	});

	test("a failure on the first rename needs no rollback", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.failForward = failOn("alpha-beta");
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.execution?.kind).toBe("RolledBack");
		if (outcome.execution?.kind !== "RolledBack") return;
		expect(outcome.execution.rolledBack).toEqual([]);
		expect(harness.rollbackBatches).toEqual([]);
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha-beta.md",
			"Library/gamma-delta.md",
		]);
		expect(harness.restoredConfigs).toEqual([oldConfig]);
	});

	test("matches executed actions by path, not identity", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.dispatch = (actions) => {
			const [first, second] = actions;
			if (first?.kind !== VaultActionKind.RenameMdFile || !second) {
				return Effect.die(new Error("unexpected plan"));
			}
			harness.files.delete("Library/alpha-beta.md");
			harness.files.add("Library/alpha ~ beta.md");
			const cause = new Error("rename rejected");
			return Effect.fail(
				new VamDispatchStoppedError({
					action: { ...second },
					cause,
					executed: [structuredClone(first)],
					failure: new VamDispatchError({
						action: { ...second },
						cause,
						operation: "executeAction",
					}),
					operation: "dispatch.stopOnFirstFailure",
					skipped: [],
				}),
			);
		};
		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RolledBack");
		if (execution.kind !== "RolledBack") return;
		expect(execution.rolledBack).toHaveLength(1);
		expect(execution.failure.path).toContain("gamma-delta.md");
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha-beta.md",
			"Library/gamma-delta.md",
		]);
	});

	test("a rename that fails after moving the file is rolled back too", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.failForward = failOn("gamma-delta", "selection restore failed");
		harness.renameBeforeFailing = true;

		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RolledBack");
		if (execution.kind !== "RolledBack") return;
		expect(
			execution.rolledBack.map((action) => action.payload.from.basename),
		).toEqual(["alpha-beta", "gamma-delta"]);
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha-beta.md",
			"Library/gamma-delta.md",
		]);
	});

	test("an unrecognised dispatch defect checks every planned file", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.dispatch = () =>
			Effect.suspend(() => {
				harness.files.delete("Library/alpha-beta.md");
				harness.files.add("Library/alpha ~ beta.md");
				return Effect.die(new Error("dispatch exploded"));
			});

		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RolledBack");
		if (execution.kind !== "RolledBack") return;
		expect(execution.failure.path).toBeUndefined();
		expect(execution.rolledBack).toHaveLength(1);
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha-beta.md",
			"Library/gamma-delta.md",
		]);
	});

	test("a planning failure touched nothing and is not observed", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		let existsCalls = 0;
		harness.exists = () => {
			existsCalls += 1;
			return Effect.succeed(true);
		};
		harness.dispatch = (actions) =>
			Effect.fail(
				new VamPlanningError({
					action: actions[0],
					cause: new Error("folder lookup failed"),
					operation: "planDispatchBatch",
				}),
			);

		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RolledBack");
		if (execution.kind !== "RolledBack") return;
		expect(execution.failure.operation).toBe("planDispatchBatch");
		expect(execution.rolledBack).toEqual([]);
		expect(existsCalls).toBe(0);
		expect(harness.rollbackBatches).toEqual([]);
	});

	test("a protected-path refusal touched nothing and is not observed", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		let existsCalls = 0;
		harness.exists = () => {
			existsCalls += 1;
			return Effect.succeed(true);
		};
		harness.dispatch = (actions) =>
			Effect.fail(
				new VamProtectedPathError({
					action: actions[0],
					operation: "dispatch.protectedPath",
					path: "Library/alpha-beta.md",
					prefix: "Library",
					relation: "inside",
				}),
			);

		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RolledBack");
		if (execution.kind !== "RolledBack") return;
		expect(execution.rolledBack).toEqual([]);
		expect(existsCalls).toBe(0);
		expect(harness.rollbackBatches).toEqual([]);
	});

	test("a partly failed rollback names the files left on the new delimiter", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
			readableMdPath("kappa-lambda"),
			readableMdPath("omega-psi"),
		]);
		harness.failForward = failOn("kappa-lambda");
		harness.failRollback = failOn("alpha ~ beta", "file is locked");
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("RollbackIncomplete");
		if (outcome.kind !== "RollbackIncomplete") return;
		const { execution } = outcome;
		expect(
			execution.leftRenamed.map((action) => action.payload.to.basename),
		).toEqual(["alpha ~ beta"]);
		expect(
			execution.rolledBack.map((action) => action.payload.from.basename),
		).toEqual(["gamma-delta"]);
		expect(execution.unresolved).toEqual([]);
		expect(execution.rollbackFailures).toHaveLength(1);
		expect(execution.rollbackFailures[0]?.action?.payload.from.basename).toBe(
			"alpha-beta",
		);
		expect(outcome.failures).toHaveLength(2);
		expect(vaultFiles(harness)).toEqual([
			"Library/alpha ~ beta.md",
			"Library/gamma-delta.md",
			"Library/kappa-lambda.md",
			"Library/omega-psi.md",
		]);
		expect(harness.restoredConfigs).toEqual([oldConfig]);

		const report = reportDelimiterMigration(outcome, delimiters);
		expect(report.keepsNewDelimiter).toBe(false);
		expect(report.persistent).toBe(true);
		expect(report.notice).toBe(
			'Delimiter change failed: could not rename Library/kappa-lambda.md → Library/kappa ~ lambda.md (rename rejected). Renamed 1 file(s) back to "-". Could not rename these back, so they still use " ~ ": Library/alpha ~ beta.md. Kept the delimiter "-"; rename the files listed by hand.',
		);
		expect(report.log).toContain("file is locked");
	});

	test("a file whose state cannot be read is reported as unresolved", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.failForward = failOn("gamma-delta");
		const exists = (path: SplitPathToMdFile) =>
			path.basename.startsWith("alpha")
				? Effect.die(new Error("stat failed"))
				: Effect.succeed(
						harness.files.has(splitPathCodec.format(path)),
					);
		harness.exists = exists;

		const execution = await Effect.runPromise(
			harness.service.execute(await plannedFor(harness)),
		);

		expect(execution.kind).toBe("RollbackIncomplete");
		if (execution.kind !== "RollbackIncomplete") return;
		expect(
			execution.unresolved.map((action) => action.payload.from.basename),
		).toEqual(["alpha-beta"]);
		expect(harness.rollbackBatches).toEqual([]);
	});

	test("renames onto a taken name are refused before anything is touched", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("alpha - beta"),
			readableMdPath("gamma-delta"),
			readableMdPath("gamma ~ delta"),
		]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.stage).toBe("Planning");
		expect(outcome.problem.cause).toBeInstanceOf(
			DelimiterRenameConflictError,
		);
		expect(outcome.problem.operation).toBe(
			"planDelimiterMigration.conflicts",
		);
		if (!(outcome.problem.cause instanceof DelimiterRenameConflictError))
			return;
		expect(outcome.problem.cause.conflicts).toEqual([
			{
				from: "Library/alpha-beta.md",
				occupiedBy: "Library/alpha - beta.md",
				reason: "SharedTarget",
				to: "Library/alpha ~ beta.md",
			},
			{
				from: "Library/gamma-delta.md",
				occupiedBy: "Library/gamma ~ delta.md",
				reason: "TargetTaken",
				to: "Library/gamma ~ delta.md",
			},
		]);
		expect(outcome.problem.cause.message).toBe(
			"2 rename(s) would land on a name already in use: Library/alpha-beta.md → Library/alpha ~ beta.md (also the new name of Library/alpha - beta.md); Library/gamma-delta.md → Library/gamma ~ delta.md (already exists)",
		);
		expect(reportDelimiterMigration(outcome, delimiters).notice).toBe(
			`Delimiter change failed before any file was renamed: ${outcome.problem.cause.message}. Kept the delimiter "-".`,
		);
		expect(harness.confirmCalls).toBe(0);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.dispatchCalls).toBe(0);
		expect(harness.restoreCalls).toBe(0);
	});

	test("a target taken by a name differing only in case is refused", async () => {
		const harness = makeHarness([
			readableMdPath("Alpha-Beta"),
			readableMdPath("alpha ~ beta"),
		]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		if (!(outcome.problem.cause instanceof DelimiterRenameConflictError))
			throw new Error("expected a rename conflict");
		expect(outcome.problem.cause.message).toBe(
			"1 rename(s) would land on a name already in use: Library/Alpha-Beta.md → Library/Alpha ~ Beta.md (Library/alpha ~ beta.md already exists)",
		);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.dispatchCalls).toBe(0);
	});

	test("on a case-sensitive file system, a target differing only in case is free", async () => {
		const harness = makeHarness(
			[readableMdPath("Alpha-Beta"), readableMdPath("alpha ~ beta")],
			{ caseInsensitive: false },
		);

		const plan = await Effect.runPromise(
			harness.service.plan(oldConfig, newConfig, root),
		);

		expect(
			plan.actions.map(({ payload }) => splitPathCodec.format(payload.to)),
		).toContain("Library/Alpha ~ Beta.md");
	});

	test("a rename that changes only its own note's case is not a conflict", async () => {
		const harness = makeHarness([readableMdPath("alphaxbeta")]);

		const plan = await Effect.runPromise(
			harness.service.plan(
				{ padded: false, symbol: "x" },
				{ padded: false, symbol: "X" },
				root,
			),
		);

		expect(plan.actions.map((action) => action.payload.to.basename)).toEqual(
			["alphaXbeta"],
		);
	});

	test("a scan defect leaves the active lifecycle untouched", async () => {
		const harness = makeHarness([]);
		harness.scan = () => Effect.die(new Error("listing exploded"));
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.stage).toBe("Planning");
		expect(harness.confirmCalls).toBe(0);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.restoreCalls).toBe(0);
	});

	test("a typed root scan failure reaches the UI boundary unchanged", async () => {
		const harness = makeHarness([]);
		const scanFailure = new VamScanError({
			cause: new Error("folder unavailable"),
			operation: "scanRoot",
			path: "Library",
		});
		harness.scan = () => Effect.fail(scanFailure);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.cause).toBe(scanFailure);
		expect(outcome.problem.operation).toBe("scanRoot");
		expect(harness.pauseCalls).toBe(0);
	});

	test("a partial scan cannot become an incomplete rename plan", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const diagnostic = new VamScanError({
			cause: new Error("nested folder unavailable"),
			operation: "scanFolder",
			path: "Library/Unavailable",
		});
		harness.scan = () =>
			Effect.succeed({
				counts: {
					folderCount: 2,
					markdownFileCount: 1,
					otherFileCount: 0,
				},
				diagnostics: [diagnostic],
				entries: [readableMdPath("alpha-beta")],
				kind: "Partial",
			});
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.stage).toBe("Planning");
		expect(outcome.problem.cause).toEqual([diagnostic]);
		expect(harness.pauseCalls).toBe(0);
		expect(harness.dispatchCalls).toBe(0);
	});

	test("a dispatch defect restores the old config after pausing", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		harness.dispatch = () => Effect.die(new Error("dispatch exploded"));
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		expect(harness.pauseCalls).toBe(1);
		expect(harness.restoredConfigs).toEqual([oldConfig]);
	});

	test("a pause failure still attempts one old-config restoration", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle({
				pause: () => Effect.fail(new Error("pause failed")),
			}),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		expect(harness.dispatchCalls).toBe(0);
		expect(harness.restoredConfigs).toEqual([oldConfig]);
		expect(harness.restoreContexts).toEqual([
			{ currentAlreadyPaused: false },
		]);
	});

	test("a restoration failure is distinct from dispatch success", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle({
				restore: () => Effect.fail(new Error("reinit failed")),
			}),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.stage).toBe("Restore");
		expect(outcome.execution?.kind).toBe("Completed");
		expect(harness.dispatchCalls).toBe(1);
		expect(harness.restoreCalls).toBe(1);
	});
});

describe("delimiter migration report", () => {
	test("a rolled back failure says what failed and that nothing kept the new delimiter", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.failForward = failOn("gamma-delta");
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle(),
			).migrate(oldConfig, newConfig, root),
		);

		const report = reportDelimiterMigration(outcome, delimiters);

		expect(report).toEqual({
			keepsNewDelimiter: false,
			librarianReinitialized: false,
			log: expect.stringContaining("renamed back: Library/alpha-beta.md"),
			notice: 'Delimiter change failed: could not rename Library/gamma-delta.md → Library/gamma ~ delta.md (rename rejected). Renamed the 1 file(s) already changed back to "-". Kept the delimiter "-".',
			persistent: false,
		});
	});

	test("a completed migration keeps the new delimiter", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle(),
			).migrate(oldConfig, newConfig, root),
		);

		expect(reportDelimiterMigration(outcome, delimiters)).toEqual({
			keepsNewDelimiter: true,
			librarianReinitialized: true,
			log: null,
			notice: 'Renamed 1 file(s) to use " ~ ".',
			persistent: false,
		});
	});

	test("a restart failure after every rename keeps the new delimiter", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle({
					restore: () => Effect.fail(new Error("reinit failed")),
				}),
			).migrate(oldConfig, newConfig, root),
		);

		expect(needsLibrarianRestartRetry(outcome)).toBe(true);
		const report = reportDelimiterMigration(outcome, delimiters, false);

		expect(report.keepsNewDelimiter).toBe(true);
		// The one retry failed: saving the settings must not try again.
		expect(report.librarianReinitialized).toBe(true);
		expect(report.persistent).toBe(true);
		expect(report.notice).toBe(
			'Renamed 1 file(s) to use " ~ " and kept that delimiter, but the Librarian did not restart. The Librarian stopped: it could not heal the library at startup. Reason: reinit failed. Run "Restart Librarian" from the command palette to try again. Details are in the developer console.',
		);
	});

	test("a restart that succeeds on its retry reports a plain completion", async () => {
		const harness = makeHarness([readableMdPath("alpha-beta")]);
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle({
					restore: () => Effect.fail(new Error("reinit failed")),
				}),
			).migrate(oldConfig, newConfig, root),
		);

		expect(reportDelimiterMigration(outcome, delimiters, true)).toEqual({
			keepsNewDelimiter: true,
			librarianReinitialized: true,
			log: expect.stringContaining("reinit failed"),
			notice: 'Renamed 1 file(s) to use " ~ ".',
			persistent: false,
		});
	});

	test("a restart failure after a rollback keeps the old delimiter", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.failForward = failOn("gamma-delta");
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle({
					restore: () => Effect.fail(new Error("reinit failed")),
				}),
			).migrate(oldConfig, newConfig, root),
		);

		const report = reportDelimiterMigration(outcome, delimiters);

		expect(outcome.kind).toBe("Failed");
		expect(needsLibrarianRestartRetry(outcome)).toBe(false);
		expect(report.keepsNewDelimiter).toBe(false);
		expect(report.persistent).toBe(true);
		expect(report.notice).toEndWith(
			'Kept the delimiter "-". The Librarian did not restart. The Librarian stopped: it could not heal the library at startup. Reason: reinit failed. Run "Restart Librarian" from the command palette to try again. Details are in the developer console.',
		);
	});

	test("lists at most five files and points to the console for the rest", async () => {
		const names = ["a", "b", "c", "d", "e", "f", "g"].map(
			(letter) => `${letter}-x`,
		);
		const harness = makeHarness([
			...names.map(readableMdPath),
			readableMdPath("z-x"),
		]);
		harness.failForward = failOn("z-x");
		harness.failRollback = () => new Error("vault is read-only");
		const outcome = await Effect.runPromise(
			new DelimiterMigrationCoordinator(
				harness.service,
				harness.lifecycle(),
			).migrate(oldConfig, newConfig, root),
		);

		const notice = reportDelimiterMigration(outcome, delimiters).notice;

		expect(notice).toContain(
			"Library/a ~ x.md, Library/b ~ x.md, Library/c ~ x.md, Library/d ~ x.md, Library/e ~ x.md, and 2 more (see the console)",
		);
		expect(notice).not.toContain("Renamed 0");
	});
});

function mdPath(
	basename: string,
	pathParts: string[] = ["Library"],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

async function plannedFor(
	harness: ReturnType<typeof makeHarness>,
): Promise<DelimiterMigrationPlan> {
	return Effect.runPromise(harness.service.plan(oldConfig, newConfig, root));
}

function readableMdPath(
	basename: string,
): Extract<VaultScanPath, { kind: "MdFile" }> {
	return { ...mdPath(basename), read: () => Effect.succeed("") };
}

type Rename = Extract<VaultAction, { kind: "RenameMdFile" }>;

/** A vault on a case-insensitive file system, as on macOS, by default. */
function makeHarness(
	paths: readonly VaultScanPath[],
	{ caseInsensitive = true } = {},
) {
	const files = new Set(paths.map((path) => splitPathCodec.format(path)));
	let failForward: (action: Rename) => Error | undefined = () => undefined;
	let failRollback: (action: Rename) => Error | undefined = () => undefined;
	let renameBeforeFailing = false;
	const rename = (action: VaultAction) => {
		if (action.kind !== VaultActionKind.RenameMdFile) return;
		const from = splitPathCodec.format(action.payload.from);
		const to = splitPathCodec.format(action.payload.to);
		if (!files.has(from) || files.has(to)) {
			throw new Error(`cannot rename ${from} to ${to}`);
		}
		files.delete(from);
		files.add(to);
	};
	const fakeStopOnFirstFailure: DelimiterMigrationVam["dispatchStopOnFirstFailure"] =
		(actions) =>
			Effect.suspend(() => {
				for (const [index, action] of actions.entries()) {
					const injected =
						action.kind === VaultActionKind.RenameMdFile
							? failForward(action)
							: undefined;
					if (injected && renameBeforeFailing) rename(action);
					const cause = injected ?? attempt(() => rename(action));
					if (!cause) continue;
					const failure = new VamDispatchError({
						action,
						cause,
						operation: "executeAction",
					});
					return Effect.fail(
						new VamDispatchStoppedError({
							action,
							cause,
							executed: actions.slice(0, index),
							failure,
							operation: "dispatch.stopOnFirstFailure",
							skipped: actions.slice(index + 1),
						}),
					);
				}
				return Effect.void;
			});
	const fakeDispatch: DelimiterMigrationVam["dispatch"] = (actions) =>
		Effect.suspend(() => {
			const errors: VamDispatchError[] = [];
			for (const action of actions) {
				const injected =
					action.kind === VaultActionKind.RenameMdFile
						? failRollback(action)
						: undefined;
				const cause = injected ?? attempt(() => rename(action));
				if (cause) {
					errors.push(
						new VamDispatchError({
							action,
							cause,
							operation: "executeAction",
						}),
					);
				}
			}
			return errors.length > 0 ? Effect.fail(errors) : Effect.void;
		});
	let dispatchImpl = fakeStopOnFirstFailure;
	let rollbackImpl = fakeDispatch;
	let existsImpl: DelimiterMigrationVam["exists"] = (path) =>
		Effect.succeed(files.has(splitPathCodec.format(path)));
	let scanImpl: DelimiterMigrationVam["scan"] = (
		_root: SplitPathToFolder,
	) =>
		Effect.succeed({
			counts: {
				folderCount: 1,
				markdownFileCount: paths.filter(
					(path) => path.kind === SplitPathKind.MdFile,
				).length,
				otherFileCount: paths.filter(
					(path) => path.kind === SplitPathKind.File,
				).length,
			},
			diagnostics: [],
			entries: [...paths],
			kind: "Complete",
		});
	let dispatchCalls = 0;
	let scanCalls = 0;
	let pauseCalls = 0;
	let restoreCalls = 0;
	let confirmCalls = 0;
	let dispatchedActions: readonly VaultAction[] | undefined;
	const rollbackBatches: (readonly VaultAction[])[] = [];
	const restoredConfigs: Readonly<SuffixDelimiterConfig>[] = [];
	const restoreContexts: {
		readonly currentAlreadyPaused: boolean;
	}[] = [];
	const vam: DelimiterMigrationVam = {
		dispatch: (actions) => {
			rollbackBatches.push(actions);
			return rollbackImpl(actions);
		},
		dispatchStopOnFirstFailure: (actions) => {
			dispatchCalls += 1;
			dispatchedActions = actions;
			return dispatchImpl(actions);
		},
		exists: (path) => existsImpl(path),
		paths: VaultPath.forFileSystem({ caseInsensitive }),
		scan: (libraryRoot) => {
			scanCalls += 1;
			return scanImpl(libraryRoot);
		},
	};
	const service = new DelimiterChangeService(vam);

	return {
		get confirmCalls() {
			return confirmCalls;
		},
		set dispatch(implementation: typeof dispatchImpl) {
			dispatchImpl = implementation;
		},
		get dispatchCalls() {
			return dispatchCalls;
		},
		get dispatchedActions() {
			return dispatchedActions;
		},
		set exists(implementation: typeof existsImpl) {
			existsImpl = implementation;
		},
		set failForward(predicate: (action: Rename) => Error | undefined) {
			failForward = predicate;
		},
		set failRollback(predicate: (action: Rename) => Error | undefined) {
			failRollback = predicate;
		},
		files,
		lifecycle(
			overrides: Partial<DelimiterMigrationLifecycle> = {},
		): DelimiterMigrationLifecycle {
			return {
				confirm: (plan) => {
					confirmCalls += 1;
					return overrides.confirm?.(plan) ?? Effect.succeed(true);
				},
				pause: () => {
					pauseCalls += 1;
					return overrides.pause?.() ?? Effect.void;
				},
				restore: (config, context) => {
					restoreCalls += 1;
					restoredConfigs.push(config);
					restoreContexts.push(context);
					return overrides.restore?.(config, context) ?? Effect.void;
				},
			};
		},
		get pauseCalls() {
			return pauseCalls;
		},
		set renameBeforeFailing(value: boolean) {
			renameBeforeFailing = value;
		},
		get restoreCalls() {
			return restoreCalls;
		},
		restoreContexts,
		restoredConfigs,
		set rollback(implementation: typeof rollbackImpl) {
			rollbackImpl = implementation;
		},
		rollbackBatches,
		set scan(implementation: typeof scanImpl) {
			scanImpl = implementation;
		},
		get scanCalls() {
			return scanCalls;
		},
		service,
	};
}

function attempt(run: () => void): Error | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
}

function failOn(basename: string, message = "rename rejected") {
	return (action: Rename) =>
		action.payload.from.basename === basename
			? new Error(message)
			: undefined;
}

function vaultFiles(harness: ReturnType<typeof makeHarness>): string[] {
	return [...harness.files].sort();
}
