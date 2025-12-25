/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testTopologicalSortProcessWriteDiscard = async () => {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
				?.getVaultActionManagerTestingApi?.() as
				| VaultActionManagerTestingApi
				| undefined;
			if (!api) throw new Error("testing api unavailable");

			const { manager, splitPath } = api;

			// Create actions in wrong order (process before write)
			// ProcessMdFile should be discarded because write comes after
			const actions = [
				{
					payload: {
						splitPath: splitPath("test.md"),
						transform: (content: string) => content + "\nprocessed",
					},
					type: "ProcessMdFile",
				},
				{
					payload: {
						content: "initial",
						splitPath: splitPath("test.md"),
					},
					type: "UpsertMdFile",
				},
			];

			await manager.dispatch(actions);

			// File should exist with just the write content (process discarded)
			const content = await manager.readContent(splitPath("test.md"));

			return {
				content,
				success: true,
			};
		});

	expect((result as any).error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toBe("initial");
	// Process should be discarded, so "processed" should NOT be in content
	expect(result.content).not.toContain("processed");
};

export const testTopologicalSortParentBeforeChild = async () => {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
				?.getVaultActionManagerTestingApi?.() as
				| VaultActionManagerTestingApi
				| undefined;
			if (!api) throw new Error("testing api unavailable");

			const { manager, splitPath } = api;

			// Create actions in wrong order (child before parent)
			const actions = [
				{
					payload: {
						splitPath: splitPath("parent/child"),
					},
					type: "CreateFolder",
				},
				{
					payload: {
						splitPath: splitPath("parent"),
					},
					type: "CreateFolder",
				},
			];

			await manager.dispatch(actions);

			// Both folders should exist
			const parentExists = await manager.exists(splitPath("parent"));
			const childExists = await manager.exists(
				splitPath("parent/child"),
			);

			return {
				childExists,
				parentExists,
				success: true,
			};
		});

	expect((result as any).error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.parentExists).toBe(true);
	expect(result.childExists).toBe(true);
};

export const testTopologicalSortWriteProcessApply = async () => {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
				?.getVaultActionManagerTestingApi?.() as
				| VaultActionManagerTestingApi
				| undefined;
			if (!api) throw new Error("testing api unavailable");

			const { manager, splitPath } = api;

			// Create actions in correct order (write before process)
			// ProcessMdFile should be applied to the write content
			const actions = [
				{
					payload: {
						content: "initial",
						splitPath: splitPath("folder/file.md"),
					},
					type: "UpsertMdFile",
				},
				{
					payload: {
						splitPath: splitPath("folder/file.md"),
						transform: (content: string) => content + "\nprocessed",
					},
					type: "ProcessMdFile",
				},
			];

			await manager.dispatch(actions);

			const content = await manager.readContent(
				splitPath("folder/file.md"),
			);

			return {
				content,
				success: true,
			};
		});

	expect((result as any).error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toContain("initial");
	expect(result.content).toContain("processed");
};

