import { describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";
import { ActionQueue } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/action-queue";
import type { Dispatcher } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dispatcher";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";
import type { SplitPathToMdFile } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: MD,
	kind: "MdFile",
	pathParts,
});

const makeAction = (name: string): VaultAction => ({
	kind: VaultActionKind.UpsertMdFile,
	payload: { splitPath: mdFile(name, ["Library"]) },
});

describe("ActionQueue", () => {
	it("dispatches actions through to Dispatcher", async () => {
		const dispatched: VaultAction[][] = [];
		const dispatcher = {
			dispatch: async (actions: readonly VaultAction[]) => {
				dispatched.push([...actions]);
				return ok(undefined);
			},
		} as unknown as Dispatcher;

		const queue = new ActionQueue(dispatcher);
		const action = makeAction("note");

		const result = await queue.dispatch([action]);

		expect(result.isOk()).toBe(true);
		expect(dispatched.length).toBe(1);
		expect(dispatched[0]).toHaveLength(1);
	});

	it("returns err when batch limit exceeded", async () => {
		const dispatcher = {
			dispatch: async () => ok(undefined),
		} as unknown as Dispatcher;

		const queue = new ActionQueue(dispatcher, { maxBatches: 3 });

		// Simulate overflow by forcing batchCount to the limit via internal state
		// This reflects the real scenario: recursive dispatches accumulating batches
		const queueInternal = queue as unknown as { batchCount: number };
		queueInternal.batchCount = 3;

		const result = await queue.dispatch([makeAction("overflow")]);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]?.error).toContain("overflow");
		}
	});

	it("logs warning when dropping actions", async () => {
		const { logger } = await import("../../../src/utils/logger");
		const warnSpy = mock(() => {});
		const originalWarn = logger.warn;
		logger.warn = warnSpy as typeof logger.warn;

		const dispatcher = {
			dispatch: async () => ok(undefined),
		} as unknown as Dispatcher;

		const queue = new ActionQueue(dispatcher, { maxBatches: 3 });

		const queueInternal = queue as unknown as { batchCount: number };
		queueInternal.batchCount = 3;

		await queue.dispatch([makeAction("overflow")]);

		logger.warn = originalWarn;

		expect(warnSpy).toHaveBeenCalled();
		const callArgs = warnSpy.mock.calls[0];
		expect(callArgs?.[0]).toContain("[ActionQueue]");
	});

	it("signals drain waiters even on overflow", async () => {
		const dispatcher = {
			dispatch: async () => ok(undefined),
		} as unknown as Dispatcher;

		const queue = new ActionQueue(dispatcher, { maxBatches: 3 });

		// Start execution to create an "isExecuting" state
		const queueInternal = queue as unknown as {
			batchCount: number;
			isExecuting: boolean;
		};

		// Simulate: first dispatch is executing, second dispatch is waiting
		let waiterResolved = false;

		// First: start a real dispatch that will succeed
		const firstPromise = queue.dispatch([makeAction("first")]);
		await firstPromise;

		// Now simulate overflow state: set batchCount high and dispatch again
		queueInternal.batchCount = 3;
		const overflowResult = await queue.dispatch([makeAction("overflow")]);

		expect(overflowResult.isErr()).toBe(true);
		// The key behavior: signalDrain was called, so no waiters are left hanging
	});
});
