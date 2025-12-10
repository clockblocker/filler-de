import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";

describe("Vault Action Manager facade e2e", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("dispatches write via manager and reads back content", async () => {
		await browser.executeObsidian(async ({ app }) => {
			await app.commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
		const result = await browser.executeObsidian(async ({ app }) => {
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getVaultActionManagerTestingApi?: () => {
					manager: {
						dispatch: (actions: unknown[]) => Promise<void>;
						readContent: (p: unknown) => Promise<string>;
						exists: (p: unknown) => Promise<boolean>;
					};
					splitPath: (input: string) => unknown;
				};
			};
			const api = plugin.getVaultActionManagerTestingApi?.();
			if (!api) throw new Error("testing api unavailable");
			const { manager, splitPath } = api;

			const target = splitPath("FacadeTest.md");
			const coreSplitPath = {
				basename: target.basename,
				pathParts: target.pathParts,
			};

			await manager.dispatch([
				{ payload: { content: "", coreSplitPath }, type: "CreateMdFile" },
			]);
			await manager.dispatch([
				{ payload: { content: "hello", coreSplitPath }, type: "WriteMdFile" },
			]);

			const exists = await manager.exists(target);
			const content = await manager.readContent(target);

			return { content, exists };
		});

		expect(result.exists).toBe(true);
		expect(result.content).toBe("hello");
	});
});
