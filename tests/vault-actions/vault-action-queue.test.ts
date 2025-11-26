import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	getActionKey,
	sortActionsByWeight,
	type VaultAction,
	VaultActionType,
} from "../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionExecutor } from "../../src/services/obsidian-services/file-services/background/vault-action-executor";
import { VaultActionQueue } from "../../src/services/obsidian-services/file-services/background/vault-action-queue";

// Mock executor that records actions
function createMockExecutor() {
	const executedActions: VaultAction[][] = [];
	const executor: VaultActionExecutor = {
		execute: async (actions: readonly VaultAction[]) => {
			executedActions.push([...actions]);
		},
	} as VaultActionExecutor;
	return { executedActions, executor };
}

describe("VaultAction utilities", () => {
	describe("getActionKey", () => {
		it("should return unique key for UpdateOrCreateFile", () => {
			const action: VaultAction = {
				payload: { prettyPath: { basename: "test", pathParts: ["Library", "Avatar"] } },
				type: VaultActionType.UpdateOrCreateFile,
			};
			expect(getActionKey(action)).toBe("UpdateOrCreateFile:Library/Avatar/test");
		});

		it("should return unique key for RenameFile using source path", () => {
			const action: VaultAction = {
				payload: {
					from: { basename: "old", pathParts: ["Library"] },
					to: { basename: "new", pathParts: ["Library"] },
				},
				type: VaultActionType.RenameFile,
			};
			expect(getActionKey(action)).toBe("RenameFile:Library/old");
		});
	});

	describe("sortActionsByWeight", () => {
		it("should sort folders before files", () => {
			const actions: VaultAction[] = [
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFolder },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0].type).toBe(VaultActionType.UpdateOrCreateFolder);
			expect(sorted[1].type).toBe(VaultActionType.UpdateOrCreateFile);
		});

		it("should sort creates before trashes", () => {
			const actions: VaultAction[] = [
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: VaultActionType.TrashFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0].type).toBe(VaultActionType.UpdateOrCreateFile);
			expect(sorted[1].type).toBe(VaultActionType.TrashFile);
		});

		it("should sort all action types correctly", () => {
			const actions: VaultAction[] = [
				{ payload: { content: "", prettyPath: { basename: "a", pathParts: [] } }, type: VaultActionType.WriteFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: VaultActionType.TrashFolder },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFolder },
				{ payload: { prettyPath: { basename: "d", pathParts: [] } }, type: VaultActionType.TrashFile },
				{ payload: { prettyPath: { basename: "e", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted.map((a) => a.type)).toEqual([
				VaultActionType.UpdateOrCreateFolder,
				VaultActionType.TrashFolder,
				VaultActionType.UpdateOrCreateFile,
				VaultActionType.TrashFile,
				VaultActionType.WriteFile,
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
				payload: { prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: VaultActionType.UpdateOrCreateFile,
			});

			expect(queue.size).toBe(1);
		});

		it("should dedupe actions with same key (last wins)", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { content: "v1", prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: VaultActionType.WriteFile,
			});

			queue.push({
				payload: { content: "v2", prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: VaultActionType.WriteFile,
			});

			expect(queue.size).toBe(1);

			const actions = queue.getQueuedActions();
			expect(actions[0].type).toBe(VaultActionType.WriteFile);
			if (actions[0].type === VaultActionType.WriteFile) {
				expect(actions[0].payload.content).toBe("v2");
			}
		});

		it("should not dedupe actions with different keys", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { content: "a", prettyPath: { basename: "file1", pathParts: ["Library"] } },
				type: VaultActionType.WriteFile,
			});

			queue.push({
				payload: { content: "b", prettyPath: { basename: "file2", pathParts: ["Library"] } },
				type: VaultActionType.WriteFile,
			});

			expect(queue.size).toBe(2);
		});
	});

	describe("pushMany", () => {
		it("should add multiple actions", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.pushMany([
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
			]);

			expect(queue.size).toBe(3);
		});
	});

	describe("flushNow", () => {
		it("should execute all queued actions immediately", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueue(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: VaultActionType.UpdateOrCreateFile,
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
				{ payload: { content: "", prettyPath: { basename: "a", pathParts: [] } }, type: VaultActionType.WriteFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFolder },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: VaultActionType.UpdateOrCreateFile },
			]);

			await queue.flushNow();

			expect(executedActions[0].map((a) => a.type)).toEqual([
				VaultActionType.UpdateOrCreateFolder,
				VaultActionType.UpdateOrCreateFile,
				VaultActionType.WriteFile,
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
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: VaultActionType.UpdateOrCreateFile,
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
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: VaultActionType.UpdateOrCreateFile,
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
				payload: { prettyPath: { basename: "a", pathParts: [] } },
				type: VaultActionType.UpdateOrCreateFile,
			});

			// Wait partial time
			await new Promise((r) => setTimeout(r, 30));

			queue.push({
				payload: { prettyPath: { basename: "b", pathParts: [] } },
				type: VaultActionType.UpdateOrCreateFile,
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

