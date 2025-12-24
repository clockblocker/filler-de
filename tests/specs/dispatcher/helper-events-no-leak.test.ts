/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

/**
 * Tests that helper events (parent folder creation, ensureFileExists) do NOT emit events.
 * Vault Action Manager contract: only emit end-user-triggered events.
 */

export const testCreateFileWithMissingParentFolders = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string; fullPath?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				fullPath: "splitPath" in event ? JSON.stringify(event.splitPath) : undefined,
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch action to create file in non-existent nested folder
		// Obsidian's vault.create() automatically creates parent folders
		// These parent folder creations should NOT emit events
		const fileSplitPath = splitPath("parent/child/file.md");
		const dispatchResult = await manager.dispatch([
			{
				payload: {
					content: "# Test",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify file was created
		const exists = await manager.exists(fileSplitPath);

		return {
			dispatchError: dispatchResult.isErr() ? dispatchResult.error : undefined,
			eventsCount: eventsReceived.length,
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	if (result.dispatchError) {
		throw new Error(`Dispatch failed: ${JSON.stringify(result.dispatchError)}`);
	}
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	// No events should be received (file creation + parent folder creations all filtered)
	if (result.eventsReceived && result.eventsReceived.length > 0) {
		throw new Error(
			`Unexpected ${result.eventsCount} events received: ${JSON.stringify(result.eventsReceived, null, 2)}`,
		);
	}
	expect(result.eventsReceived).toHaveLength(0);
};

export const testCreateFolderWithMissingParents = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch action to create nested folder
		// Obsidian's vault.createFolder() automatically creates parent folders
		// These parent folder creations should NOT emit events
		const folderSplitPath = splitPath("a/b/c/d");
		await manager.dispatch([
			{
				payload: {
					splitPath: folderSplitPath,
				},
				type: "CreateFolder",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify folder was created
		const exists = await manager.exists(folderSplitPath);

		return {
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	// No events should be received (folder creation + parent folder creations all filtered)
	expect(result.eventsReceived).toHaveLength(0);
};

export const testProcessMdFileWithEnsureFileExists = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch ProcessMdFile on non-existent file
		// Executor.ensureFileExists() will create the file
		// This file creation should NOT emit events
		const fileSplitPath = splitPath("process-helper-test.md");
		await manager.dispatch([
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (content: string) => content + "\n# Processed",
				},
				type: "ProcessMdFile",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify file was created
		const exists = await manager.exists(fileSplitPath);

		return {
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	// No events should be received (helper file creation filtered)
	expect(result.eventsReceived).toHaveLength(0);
};

export const testProcessMdFileWithMissingParentFolders = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch ProcessMdFile on non-existent file in non-existent folder
		// ensureFileExists creates file, which creates parent folders
		// All these helper creations should NOT emit events
		const fileSplitPath = splitPath("x/y/z/process-nested.md");
		await manager.dispatch([
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (content: string) => content + "\n# Processed",
				},
				type: "ProcessMdFile",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify file was created
		const exists = await manager.exists(fileSplitPath);

		return {
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	// No events should be received (helper file + parent folder creations all filtered)
	expect(result.eventsReceived).toHaveLength(0);
};

export const testUpsertMdFileWithEnsureFileExists = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch UpsertMdFile on non-existent file
		// Executor creates the file directly with content
		// This file creation should NOT emit events
		const fileSplitPath = splitPath("replace-helper-test.md");
		await manager.dispatch([
			{
				payload: {
					content: "# Replaced Content",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify file was created
		const exists = await manager.exists(fileSplitPath);
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	expect(result.content).toBe("# Replaced Content");
	// No events should be received (helper file creation filtered)
	expect(result.eventsReceived).toHaveLength(0);
};

export const testUpsertMdFileWithMissingParentFolders = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch UpsertMdFile on non-existent file in non-existent folder
		// Executor creates file, which creates parent folders
		// All these helper creations should NOT emit events
		const fileSplitPath = splitPath("m/n/o/replace-nested.md");
		await manager.dispatch([
			{
				payload: {
					content: "# Nested Replaced",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Cleanup
		teardown();

		// Verify file was created
		const exists = await manager.exists(fileSplitPath);
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			eventsReceived,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	expect(result.content).toBe("# Nested Replaced");
	// No events should be received (helper file + parent folder creations all filtered)
	expect(result.eventsReceived).toHaveLength(0);
};

export const testMultipleNestedOperations = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Subscribe to events
		const eventsReceived: Array<{ type: string; path?: string }> = [];
		const teardown = manager.subscribe(async (event) => {
			eventsReceived.push({
				path: "splitPath" in event ? event.splitPath.basename : undefined,
				type: event.type,
			});
		});

		// Dispatch multiple operations that create nested structures
		// All helper folder/file creations should NOT emit events
		await manager.dispatch([
			{
				payload: {
					splitPath: splitPath("multi/a/b"),
				},
				type: "CreateFolder",
			},
			{
				payload: {
					content: "# File 1",
					splitPath: splitPath("multi/a/b/file1.md"),
				},
				type: "UpsertMdFile",
			},
			{
				payload: {
					content: "# File 2",
					splitPath: splitPath("multi/c/d/file2.md"),
				},
				type: "UpsertMdFile",
			},
			{
				payload: {
					splitPath: splitPath("multi/e/f/g"),
				},
				type: "CreateFolder",
			},
		]);

		// Wait for any events
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Cleanup
		teardown();

		// Verify all were created
		const folder1 = await manager.exists(splitPath("multi/a/b"));
		const folder2 = await manager.exists(splitPath("multi/e/f/g"));
		const file1 = await manager.exists(splitPath("multi/a/b/file1.md"));
		const file2 = await manager.exists(splitPath("multi/c/d/file2.md"));

		return {
			eventsReceived,
			file1,
			file2,
			folder1,
			folder2,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.folder1).toBe(true);
	expect(result.folder2).toBe(true);
	expect(result.file1).toBe(true);
	expect(result.file2).toBe(true);
	// No events should be received (all operations + helper creations filtered)
	expect(result.eventsReceived).toHaveLength(0);
};
