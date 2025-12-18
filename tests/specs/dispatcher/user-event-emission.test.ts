/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testUserEventEmission = async () => {
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

		// Create file using Obsidian API directly (user-triggered, not via dispatch)
		const filePath = "user-event-test.md";
		await app.vault.create(filePath, "# User Event Test");

		// Wait a bit for event to arrive
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Cleanup
		teardown();

		// Verify file was created
		const fileSplitPath = splitPath(filePath);
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
	// Event should be received (user-triggered, not filtered)
	expect(result.eventsReceived).toHaveLength(1);
	expect(result.eventsReceived[0]?.type).toBe("FileCreated");
	// basename now correctly excludes extension
	expect(result.eventsReceived[0]?.path).toBe("user-event-test");
};
