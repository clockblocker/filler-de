import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";

describe("OpenedFileService e2e", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("reads active md, reports active view, and returns pwd", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			// Obsidian plugin registry is untyped in this environment.
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getOpenedFileServiceTestingApi?: () => {
					openedFileService: {
						readContent: (p: unknown) => Promise<string>;
						pwd: () => Promise<unknown>;
						isInActiveView: (p: unknown) => Promise<boolean>;
					};
					splitPath: (input: string) => unknown;
					splitPathKey: (p: unknown) => string;
				};
			};
			const api = plugin.getOpenedFileServiceTestingApi?.();
			if (!api) throw new Error("testing api unavailable");

			const { openedFileService, splitPath, splitPathKey } = api;

			await app.workspace.openLinkText("Welcome.md", "", false);
			const target = splitPath("Welcome.md");

			const content = await openedFileService.readContent(target);
			const pwd = await openedFileService.pwd();
			const isActive = await openedFileService.isInActiveView(target);

			return {
				content,
				isActive,
				pwd: splitPathKey(pwd),
			};
		});

		expect(result.content.startsWith("This is your vault")).toBe(true);
		expect(result.pwd).toBe("Welcome.md");
		expect(result.isActive).toBe(true);
	});

	it("lists folder children and checks existence", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			// Obsidian plugin registry is untyped in this environment.
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getOpenedFileServiceTestingApi?: () => {
					openedFileService: {
						list: (p: unknown) => Promise<unknown[]>;
						exists: (p: unknown) => Promise<boolean>;
					};
					splitPath: (input: string) => unknown;
					splitPathKey: (p: unknown) => string;
				};
			};
			const api = plugin.getOpenedFileServiceTestingApi?.();
			if (!api) throw new Error("testing api unavailable");

			const { openedFileService, splitPath, splitPathKey } = api;

			await app.vault.createFolder("TempE2E").catch(() => {});
			await app.vault.create("TempE2E/Note.md", "note").catch(() => {});

			const folder = splitPath("TempE2E");
			const file = splitPath("TempE2E/Note.md");
			const missing = splitPath("Missing/Nope.md");

			const listed = await openedFileService.list(folder);
			const existsFile = await openedFileService.exists(file);
			const existsMissing = await openedFileService.exists(missing);

			return {
				existsFile,
				existsMissing,
				listed: listed.map(splitPathKey).sort(),
			};
		});

		expect(result.existsFile).toBe(true);
		expect(result.existsMissing).toBe(false);
		expect(result.listed).toContain("TempE2E/Note.md");
	});
});
