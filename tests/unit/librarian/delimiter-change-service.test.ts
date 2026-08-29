import { describe, expect, test } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	VamDispatchError,
	VamVaultIoError,
	type VaultAction,
	type VaultActionManagerReadablePath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	DelimiterChangeService,
	type DelimiterMigrationVam,
} from "../../../src/commanders/librarian/runtime/delimiter-change-service";
import {
	DelimiterMigrationCoordinator,
	type DelimiterMigrationLifecycle,
} from "../../../src/commanders/librarian/runtime/delimiter-migration-coordinator";
import {
	type DelimiterMigrationPlan,
	planDelimiterMigration,
} from "../../../src/commanders/librarian/runtime/delimiter-migration-plan";
import type { SuffixDelimiterConfig } from "../../../src/types";

const oldConfig = { padded: false, symbol: "-" } satisfies SuffixDelimiterConfig;
const newConfig = { padded: true, symbol: "~" } satisfies SuffixDelimiterConfig;
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
		expect(harness.listCalls).toBe(0);
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
		expect(harness.listCalls).toBe(1);
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

	test("partial dispatch failure retains successes and restores old config", async () => {
		const harness = makeHarness([
			readableMdPath("alpha-beta"),
			readableMdPath("gamma-delta"),
		]);
		harness.dispatch = (actions) =>
			Effect.fail([
				new VamDispatchError({
					action: actions[1],
					cause: new Error("rename rejected"),
					operation: "executeAction",
				}),
			]);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("PartiallyFailed");
		if (outcome.kind !== "PartiallyFailed") return;
		expect(outcome.renamedCount).toBe(1);
		expect(outcome.failures).toHaveLength(1);
		expect(outcome.failures[0]?.operation).toBe("executeAction");
		expect(outcome.failures[0]?.path).toContain("gamma-delta.md");
		expect(harness.restoredConfigs).toEqual([oldConfig]);
	});

	test("a listing defect leaves the active lifecycle untouched", async () => {
		const harness = makeHarness([]);
		harness.list = () => Effect.die(new Error("listing exploded"));
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

	test("a typed listing failure reaches the UI boundary unchanged", async () => {
		const harness = makeHarness([]);
		const listingFailure = new VamVaultIoError({
			cause: new Error("folder unavailable"),
			operation: "list",
			path: "Library",
		});
		harness.list = () => Effect.fail(listingFailure);
		const coordinator = new DelimiterMigrationCoordinator(
			harness.service,
			harness.lifecycle(),
		);

		const outcome = await Effect.runPromise(
			coordinator.migrate(oldConfig, newConfig, root),
		);

		expect(outcome.kind).toBe("Failed");
		if (outcome.kind !== "Failed") return;
		expect(outcome.problem.cause).toBe(listingFailure);
		expect(outcome.problem.operation).toBe("list");
		expect(harness.pauseCalls).toBe(0);
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

function readableMdPath(
	basename: string,
): Extract<VaultActionManagerReadablePath, { kind: "MdFile" }> {
	return { ...mdPath(basename), read: () => Effect.succeed("") };
}

function makeHarness(paths: readonly VaultActionManagerReadablePath[]) {
	let dispatchImpl: DelimiterMigrationVam["dispatch"] = (
		_actions: readonly VaultAction[],
	) => Effect.void;
	let listImpl: DelimiterMigrationVam["listAllFilesWithMdReaders"] = (
		_root: SplitPathToFolder,
	) => Effect.succeed([...paths]);
	let dispatchCalls = 0;
	let listCalls = 0;
	let pauseCalls = 0;
	let restoreCalls = 0;
	let confirmCalls = 0;
	let dispatchedActions: readonly VaultAction[] | undefined;
	const restoredConfigs: Readonly<SuffixDelimiterConfig>[] = [];
	const restoreContexts: {
		readonly currentAlreadyPaused: boolean;
	}[] = [];
	const vam: DelimiterMigrationVam = {
		dispatch: (actions) => {
			dispatchCalls += 1;
			dispatchedActions = actions;
			return dispatchImpl(actions);
		},
		listAllFilesWithMdReaders: (libraryRoot) => {
			listCalls += 1;
			return listImpl(libraryRoot);
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
		set list(implementation: typeof listImpl) {
			listImpl = implementation;
		},
		get listCalls() {
			return listCalls;
		},
		get pauseCalls() {
			return pauseCalls;
		},
		get restoreCalls() {
			return restoreCalls;
		},
		restoreContexts,
		restoredConfigs,
		service,
	};
}
