/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testSelfEventFiltering = async () => {
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

		// Dispatch action (should NOT emit event to subscribers)
		const fileSplitPath = splitPath("self-event-test.md");
		await manager.dispatch([
			{
				payload: {
					content: "# Self Event Test",
					splitPath: fileSplitPath,
				},
				type: "CreateMdFile",
			},
		]);

		// Wait a bit for any events to arrive
		await new Promise((resolve) => setTimeout(resolve, 100));

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
	// No events should be received (self-events filtered)
	expect(result.eventsReceived).toHaveLength(0);
};
