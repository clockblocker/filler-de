import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";

describe("Reader e2e", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("reads active md, checks exists, lists folder, and pwd", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getReaderTestingApi?: () => {
					reader: {
						readContent: (p: unknown) => Promise<string>;
						exists: (p: unknown) => Promise<boolean>;
						list: (p: unknown) => Promise<unknown[]>;
						pwd: () => Promise<unknown>;
					};
					splitPath: (input: string) => unknown;
					splitPathKey: (p: unknown) => string;
				};
			};
			const api = plugin.getReaderTestingApi?.();
			if (!api) throw new Error("testing api unavailable");
			const { reader, splitPath, splitPathKey } = api;

			await app.workspace.openLinkText("Welcome.md", "", false);

			await app.vault.createFolder("Reader").catch(() => {});
			await app.vault.create("Reader/Note.md", "note").catch(() => {});

			const target = splitPath("Welcome.md");
			const folder = splitPath("Reader");
			const file = splitPath("Reader/Note.md");
			const missing = splitPath("Missing/Nope.md");

			const content = await reader.readContent(target);
			const existsWelcome = await reader.exists(target);
			const existsMissing = await reader.exists(missing);
			const listed = await reader.list(folder);
			const pwd = await reader.pwd();

			return {
				content,
				existsMissing,
				existsWelcome,
				listed: listed.map(splitPathKey).sort(),
				pwd: splitPathKey(pwd),
			};
		});

		expect(result.content.startsWith("This is your vault")).toBe(true);
		expect(result.existsWelcome).toBe(true);
		expect(result.existsMissing).toBe(false);
		expect(result.listed).toContain("Reader/Note.md");
		expect(result.pwd).toBe("Welcome.md");
	});
});
