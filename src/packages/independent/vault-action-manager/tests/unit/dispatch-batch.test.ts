import { describe, expect, it } from "bun:test";
import { err, ok, type Result } from "neverthrow";
import {
	DispatchBatchCoordinator,
	type DispatchBatchOptions,
} from "../../src/impl/actions-processing/dispatch-batch";
import type { Executor } from "../../src/impl/actions-processing/executor";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { MD } from "../../src/types/literals";
import type { SplitPathToMdFile } from "../../src/types/split-path";
import type { VaultAction } from "../../src/types/vault-action";
import { VaultActionKind } from "../../src/types/vault-action";

const mdFile = (basename: string): SplitPathToMdFile => ({
	basename,
	extension: MD,
	kind: "MdFile",
	pathParts: ["Library"],
});

const makeAction = (basename: string): VaultAction => ({
	kind: VaultActionKind.UpsertMdFile,
	payload: { splitPath: mdFile(basename) },
});

function actionBasename(action: VaultAction): string {
	if (action.kind !== VaultActionKind.UpsertMdFile) {
		throw new Error(`Expected UpsertMdFile, received ${action.kind}`);
	}
	return action.payload.splitPath.basename;
}

function makeCoordinator(
	execute: (action: VaultAction) => Promise<Result<unknown, string>>,
	options?: DispatchBatchOptions,
) {
	const executor = { execute } as unknown as Executor;
	const selfEvents = { register: () => {} } as unknown as SelfEventTracker;
	return new DispatchBatchCoordinator(
		executor,
		selfEvents,
		{ exists: () => true },
		options,
	);
}

describe("DispatchBatchCoordinator", () => {
	it("executes a submitted batch through its single interface", async () => {
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			return ok(undefined);
		});
		const action = makeAction("note");

		const result = await coordinator.dispatch([action]);

		expect(result.isOk()).toBe(true);
		expect(executed).toEqual([action]);
	});

	it("returns each queued caller the result of its own submitted batch", async () => {
		let releaseFirst: () => void = () => {};
		let markFirstStarted: () => void = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve;
		});
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const coordinator = makeCoordinator(async (action) => {
			if (actionBasename(action) === "first") {
				markFirstStarted();
				await firstGate;
				return ok(undefined);
			}
			return err("second batch failed");
		});

		const firstResultPromise = coordinator.dispatch([makeAction("first")]);
		await firstStarted;
		const secondResultPromise = coordinator.dispatch([
			makeAction("second"),
		]);
		releaseFirst();

		const [firstResult, secondResult] = await Promise.all([
			firstResultPromise,
			secondResultPromise,
		]);

		expect(firstResult.isOk()).toBe(true);
		expect(secondResult.isErr()).toBe(true);
		if (secondResult.isErr()) {
			expect(secondResult.error).toHaveLength(1);
			expect(
				actionBasename(
					secondResult.error[0]?.action ?? makeAction("missing"),
				),
			).toBe("second");
			expect(secondResult.error[0]?.error).toBe("second batch failed");
		}
	});

	it("continues later submitted batches after an earlier failure", async () => {
		const coordinator = makeCoordinator(async (action) =>
			actionBasename(action) === "failed" ? err("failed") : ok(undefined),
		);

		const failed = coordinator.dispatch([makeAction("failed")]);
		const succeeded = coordinator.dispatch([makeAction("succeeded")]);

		expect((await failed).isErr()).toBe(true);
		expect((await succeeded).isOk()).toBe(true);
	});

	it("attributes thrown exceptions to the submitted action", async () => {
		const action = makeAction("throws");
		const coordinator = makeCoordinator(async () => {
			throw new Error("boom");
		});

		const result = await coordinator.dispatch([action]);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual([
				{ action, error: "EXCEPTION: boom" },
			]);
		}
	});

	it("returns planning exceptions instead of leaving the caller unresolved", async () => {
		const action = makeAction("planning");
		if (action.kind !== VaultActionKind.UpsertMdFile) {
			throw new Error("Expected UpsertMdFile test fixture");
		}
		action.payload.content = "before";
		const coordinator = makeCoordinator(async () => ok(undefined));

		const result = await coordinator.dispatch([
			action,
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("planning"),
					transform: () => {
						throw new Error("planning failed");
					},
				},
			},
		]);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]?.error).toBe("EXCEPTION: planning failed");
		}
	});

	it("returns overflow errors to every dropped submitted batch", async () => {
		let releaseFirst: () => void = () => {};
		let markFirstStarted: () => void = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve;
		});
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const coordinator = makeCoordinator(
			async (action) => {
				if (actionBasename(action) === "first") {
					markFirstStarted();
					await firstGate;
				}
				return ok(undefined);
			},
			{ maxBatches: 2 },
		);

		const first = coordinator.dispatch([makeAction("first")]);
		await firstStarted;
		const second = coordinator.dispatch([makeAction("second")]);
		const overflowed = coordinator.dispatch([makeAction("overflowed")]);
		releaseFirst();

		expect((await first).isOk()).toBe(true);
		expect((await second).isOk()).toBe(true);
		const overflowResult = await overflowed;
		expect(overflowResult.isErr()).toBe(true);
		if (overflowResult.isErr()) {
			expect(overflowResult.error[0]?.error).toContain("overflow");
		}
	});
});
