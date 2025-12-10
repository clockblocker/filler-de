import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";

describe("BackgroundFileService e2e", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("creates, writes, reads, renames, and trashes md files", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getBackgroundFileServiceTestingApi?: () => {
					backgroundFileService: {
						createFolder: (p: unknown) => Promise<unknown>;
						createFile: (p: unknown, content?: string) => Promise<unknown>;
						writeFile: (p: unknown, content: string) => Promise<void>;
						readContent: (p: unknown) => Promise<string>;
						renameFile: (f: unknown, t: unknown) => Promise<void>;
						trashFile: (p: unknown) => Promise<void>;
						exists: (p: unknown) => Promise<boolean>;
					};
					splitPath: (input: string) => unknown;
					splitPathKey: (p: unknown) => string;
				};
			};
			const api = plugin.getBackgroundFileServiceTestingApi?.();
			if (!api) throw new Error("testing api unavailable");

			const { backgroundFileService, splitPath, splitPathKey } = api;

			const folder = splitPath("TempBG");
			await backgroundFileService.createFolder(folder);

			const file = splitPath("TempBG/Note.md");
			await backgroundFileService.createFile(file, "hello");
			await backgroundFileService.writeFile(file, "world");
			const readBack = await backgroundFileService.readContent(file);

			const renamed = splitPath("TempBG/Renamed.md");
			await backgroundFileService.renameFile(file, renamed);

			const existsOld = await backgroundFileService.exists(file);
			const existsNew = await backgroundFileService.exists(renamed);

			await backgroundFileService.trashFile(renamed);
			const existsAfterTrash = await backgroundFileService.exists(renamed);

			return {
				existsAfterTrash,
				existsNew,
				existsOld,
				finalKey: splitPathKey(renamed),
				readBack,
			};
		});

		expect(result.readBack).toBe("world");
		expect(result.existsOld).toBe(false);
		expect(result.existsNew).toBe(true);
		expect(result.existsAfterTrash).toBe(false);
		expect(result.finalKey).toBe("TempBG/Renamed.md");
	});
});
