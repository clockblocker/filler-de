import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
	type BackgroundVaultAction,
	BackgroundVaultActionType,
	getActionKey,
	sortActionsByWeight,
} from "../../src/services/obsidian-services/file-services/background/background-vault-actions";
import { VaultActionQueue } from "../../src/services/obsidian-services/file-services/background/vault-action-queue";
import type { VaultActionExecutor } from "../../src/services/obsidian-services/file-services/background/vault-action-executor";

// Mock executor that records actions
function createMockExecutor() {
	const executedActions: BackgroundVaultAction[][] = [];
	const executor: VaultActionExecutor = {
		execute: async (actions: readonly BackgroundVaultAction[]) => {
			executedActions.push([...actions]);
		},
	} as VaultActionExecutor;
	return { executor, executedActions };
}

describe("BackgroundVaultAction utilities", () => {
	describe("getActionKey", () => {
		it("should return unique key for CreateFile", () => {
			const action: BackgroundVaultAction = {
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: ["Library", "Avatar"], basename: "test" } },
			};
			expect(getActionKey(action)).toBe("CreateFile:Library/Avatar/test");
		});

		it("should return unique key for RenameFile using source path", () => {
			const action: BackgroundVaultAction = {
				type: BackgroundVaultActionType.RenameFile,
				payload: {
					from: { pathParts: ["Library"], basename: "old" },
					to: { pathParts: ["Library"], basename: "new" },
				},
			};
			expect(getActionKey(action)).toBe("RenameFile:Library/old");
		});
	});

	describe("sortActionsByWeight", () => {
		it("should sort folders before files", () => {
			const actions: BackgroundVaultAction[] = [
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "a" } } },
				{ type: BackgroundVaultActionType.CreateFolder, payload: { prettyPath: { pathParts: [], basename: "b" } } },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0].type).toBe(BackgroundVaultActionType.CreateFolder);
			expect(sorted[1].type).toBe(BackgroundVaultActionType.CreateFile);
		});

		it("should sort creates before trashes", () => {
			const actions: BackgroundVaultAction[] = [
				{ type: BackgroundVaultActionType.TrashFile, payload: { prettyPath: { pathParts: [], basename: "a" } } },
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "b" } } },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0].type).toBe(BackgroundVaultActionType.CreateFile);
			expect(sorted[1].type).toBe(BackgroundVaultActionType.TrashFile);
		});

		it("should sort all action types correctly", () => {
			const actions: BackgroundVaultAction[] = [
				{ type: BackgroundVaultActionType.WriteFile, payload: { prettyPath: { pathParts: [], basename: "a" }, content: "" } },
				{ type: BackgroundVaultActionType.TrashFolder, payload: { prettyPath: { pathParts: [], basename: "b" } } },
				{ type: BackgroundVaultActionType.CreateFolder, payload: { prettyPath: { pathParts: [], basename: "c" } } },
				{ type: BackgroundVaultActionType.TrashFile, payload: { prettyPath: { pathParts: [], basename: "d" } } },
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "e" } } },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted.map((a) => a.type)).toEqual([
				BackgroundVaultActionType.CreateFolder,
				BackgroundVaultActionType.TrashFolder,
				BackgroundVaultActionType.CreateFile,
				BackgroundVaultActionType.TrashFile,
				BackgroundVaultActionType.WriteFile,
			]);
		});
	});
});

describe("VaultActionQueue", () => {
	describe("push and deduplication", () => {
		it("should add action to queue", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: ["Library"], basename: "test" } },
			});

			expect(queue.size).toBe(1);
		});

		it("should dedupe actions with same key (last wins)", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				type: BackgroundVaultActionType.WriteFile,
				payload: { prettyPath: { pathParts: ["Library"], basename: "test" }, content: "v1" },
			});

			queue.push({
				type: BackgroundVaultActionType.WriteFile,
				payload: { prettyPath: { pathParts: ["Library"], basename: "test" }, content: "v2" },
			});

			expect(queue.size).toBe(1);

			const actions = queue.getQueuedActions();
			expect(actions[0].type).toBe(BackgroundVaultActionType.WriteFile);
			if (actions[0].type === BackgroundVaultActionType.WriteFile) {
				expect(actions[0].payload.content).toBe("v2");
			}
		});

		it("should not dedupe actions with different keys", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				type: BackgroundVaultActionType.WriteFile,
				payload: { prettyPath: { pathParts: ["Library"], basename: "file1" }, content: "a" },
			});

			queue.push({
				type: BackgroundVaultActionType.WriteFile,
				payload: { prettyPath: { pathParts: ["Library"], basename: "file2" }, content: "b" },
			});

			expect(queue.size).toBe(2);
		});
	});

	describe("pushMany", () => {
		it("should add multiple actions", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.pushMany([
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "a" } } },
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "b" } } },
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "c" } } },
			]);

			expect(queue.size).toBe(3);
		});
	});

	describe("flushNow", () => {
		it("should execute all queued actions immediately", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: [], basename: "test" } },
			});

			await queue.flushNow();

			expect(executedActions.length).toBe(1);
			expect(executedActions[0].length).toBe(1);
			expect(queue.isEmpty).toBe(true);
		});

		it("should sort actions by weight before executing", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.pushMany([
				{ type: BackgroundVaultActionType.WriteFile, payload: { prettyPath: { pathParts: [], basename: "a" }, content: "" } },
				{ type: BackgroundVaultActionType.CreateFolder, payload: { prettyPath: { pathParts: [], basename: "b" } } },
				{ type: BackgroundVaultActionType.CreateFile, payload: { prettyPath: { pathParts: [], basename: "c" } } },
			]);

			await queue.flushNow();

			expect(executedActions[0].map((a) => a.type)).toEqual([
				BackgroundVaultActionType.CreateFolder,
				BackgroundVaultActionType.CreateFile,
				BackgroundVaultActionType.WriteFile,
			]);
		});

		it("should not execute if queue is empty", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			await queue.flushNow();

			expect(executedActions.length).toBe(0);
		});
	});

	describe("clear", () => {
		it("should remove all actions without executing", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: [], basename: "test" } },
			});

			queue.clear();

			expect(queue.isEmpty).toBe(true);

			// Wait to ensure no delayed flush happens
			await new Promise((r) => setTimeout(r, 50));
			expect(executedActions.length).toBe(0);
		});
	});

	describe("debouncing", () => {
		it("should debounce flush with configured delay", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 50 });

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: [], basename: "test" } },
			});

			// Not flushed immediately
			expect(executedActions.length).toBe(0);

			// Wait for debounce
			await new Promise((r) => setTimeout(r, 100));

			expect(executedActions.length).toBe(1);
		});

		it("should reset debounce timer on new push", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 50 });

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: [], basename: "a" } },
			});

			// Wait partial time
			await new Promise((r) => setTimeout(r, 30));

			queue.push({
				type: BackgroundVaultActionType.CreateFile,
				payload: { prettyPath: { pathParts: [], basename: "b" } },
			});

			// Still not flushed (timer reset)
			expect(executedActions.length).toBe(0);

			// Wait for full debounce from second push
			await new Promise((r) => setTimeout(r, 80));

			// Now flushed with both actions
			expect(executedActions.length).toBe(1);
			expect(executedActions[0].length).toBe(2);
		});
	});
});

