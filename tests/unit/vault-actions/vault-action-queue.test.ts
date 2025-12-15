import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	getActionKey,
	type LegacyVaultAction,
	LegacyVaultActionType,
	sortActionsByWeight,
} from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionExecutor } from "../../../src/services/obsidian-services/file-services/background/vault-action-executor";
import { VaultActionQueueLegacy } from "../../../src/services/obsidian-services/file-services/vault-action-queue";

// Mock executor that records actions
function createMockExecutor() {
	const executedActions: LegacyVaultAction[][] = [];
	const executor: VaultActionExecutor = {
		execute: async (actions: readonly LegacyVaultAction[]) => {
			executedActions.push([...actions]);
		},
	} as VaultActionExecutor;
	return { executedActions, executor };
}

describe("VaultAction utilities", () => {
	describe("getActionKey", () => {
		it("should return unique key for UpdateOrCreateFile", () => {
			const action: LegacyVaultAction = {
				payload: { prettyPath: { basename: "test", pathParts: ["Library", "Avatar"] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			};
			expect(getActionKey(action)).toBe("UpdateOrCreateFile:Library/Avatar/test");
		});

		it("should return unique key for RenameFile using source path", () => {
			const action: LegacyVaultAction = {
				payload: {
					from: { basename: "old", pathParts: ["Library"] },
					to: { basename: "new", pathParts: ["Library"] },
				},
				type: LegacyVaultActionType.RenameFile,
			};
			expect(getActionKey(action)).toBe("RenameFile:Library/old");
		});
	});

	describe("sortActionsByWeight", () => {
		it("should sort folders before files", () => {
			const actions: LegacyVaultAction[] = [
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFolder },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0]?.type).toBe(LegacyVaultActionType.UpdateOrCreateFolder);
			expect(sorted[1]?.type).toBe(LegacyVaultActionType.UpdateOrCreateFile);
		});

		it("should sort creates before trashes", () => {
			const actions: LegacyVaultAction[] = [
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: LegacyVaultActionType.TrashFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted[0]?.type).toBe(LegacyVaultActionType.UpdateOrCreateFile);
			expect(sorted[1]?.type).toBe(LegacyVaultActionType.TrashFile);
		});

		it("should sort all action types correctly", () => {
			const actions: LegacyVaultAction[] = [
				{ payload: { content: "", prettyPath: { basename: "a", pathParts: [] } }, type: LegacyVaultActionType.WriteFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: LegacyVaultActionType.TrashFolder },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFolder },
				{ payload: { prettyPath: { basename: "d", pathParts: [] } }, type: LegacyVaultActionType.TrashFile },
				{ payload: { prettyPath: { basename: "e", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
			];

			const sorted = sortActionsByWeight(actions);

			expect(sorted.map((a) => a.type)).toEqual([
				LegacyVaultActionType.UpdateOrCreateFolder,
				LegacyVaultActionType.TrashFolder,
				LegacyVaultActionType.UpdateOrCreateFile,
				LegacyVaultActionType.TrashFile,
				LegacyVaultActionType.WriteFile,
			]);
		});
	});
});

describe("VaultActionQueue", () => {
	describe("push and deduplication", () => {
		it("should add action to queue", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			});

			expect(queue.size).toBe(1);
		});

		it("should dedupe actions with same key (last wins)", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { content: "v1", prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: LegacyVaultActionType.WriteFile,
			});

			queue.push({
				payload: { content: "v2", prettyPath: { basename: "test", pathParts: ["Library"] } },
				type: LegacyVaultActionType.WriteFile,
			});

			expect(queue.size).toBe(1);

			const actions = queue.getQueuedActions();
			expect(actions[0]?.type).toBe(LegacyVaultActionType.WriteFile);
			if (actions[0]?.type === LegacyVaultActionType.WriteFile) {
				expect(actions[0]?.payload.content).toBe("v2");
			}
		});

		it("should not dedupe actions with different keys", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { content: "a", prettyPath: { basename: "file1", pathParts: ["Library"] } },
				type: LegacyVaultActionType.WriteFile,
			});

			queue.push({
				payload: { content: "b", prettyPath: { basename: "file2", pathParts: ["Library"] } },
				type: LegacyVaultActionType.WriteFile,
			});

			expect(queue.size).toBe(2);
		});
	});

	describe("pushMany", () => {
		it("should add multiple actions", () => {
			const { executor } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.pushMany([
				{ payload: { prettyPath: { basename: "a", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
			]);

			expect(queue.size).toBe(3);
		});
	});

	describe("flushNow", () => {
		it("should execute all queued actions immediately", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			});

			await queue.flushNow();

			expect(executedActions.length).toBe(1);
			expect(executedActions[0]?.length).toBe(1);
			expect(queue.isEmpty).toBe(true);
		});

		it("should sort actions by weight before executing", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.pushMany([
				{ payload: { content: "", prettyPath: { basename: "a", pathParts: [] } }, type: LegacyVaultActionType.WriteFile },
				{ payload: { prettyPath: { basename: "b", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFolder },
				{ payload: { prettyPath: { basename: "c", pathParts: [] } }, type: LegacyVaultActionType.UpdateOrCreateFile },
			]);

			await queue.flushNow();

			expect(executedActions[0]?.map((a) => a.type)).toEqual([
				LegacyVaultActionType.UpdateOrCreateFolder,
				LegacyVaultActionType.UpdateOrCreateFile,
				LegacyVaultActionType.WriteFile,
			]);
		});

		it("should not execute if queue is empty", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			await queue.flushNow();

			expect(executedActions.length).toBe(0);
		});
	});

	describe("clear", () => {
		it("should remove all actions without executing", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 1000 });

			queue.push({
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
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
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 50 });

			queue.push({
				payload: { prettyPath: { basename: "test", pathParts: [] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			});

			// Not flushed immediately
			expect(executedActions.length).toBe(0);

			// Wait for debounce
			await new Promise((r) => setTimeout(r, 100));

			expect(executedActions.length).toBe(1);
		});

		it("should reset debounce timer on new push", async () => {
			const { executor, executedActions } = createMockExecutor();
			const queue = new VaultActionQueueLegacy(executor, { flushDelayMs: 50 });

			queue.push({
				payload: { prettyPath: { basename: "a", pathParts: [] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			});

			// Wait partial time
			await new Promise((r) => setTimeout(r, 30));

			queue.push({
				payload: { prettyPath: { basename: "b", pathParts: [] } },
				type: LegacyVaultActionType.UpdateOrCreateFile,
			});

			// Still not flushed (timer reset)
			expect(executedActions.length).toBe(0);

			// Wait for full debounce from second push
			await new Promise((r) => setTimeout(r, 80));

			// Now flushed with both actions
			expect(executedActions.length).toBe(1);
			expect(executedActions[0]?.length).toBe(2);
		});
	});
});

