import { browser } from "@wdio/globals";
import { build } from "esbuild";
import path from "path";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";

const openedFileServiceBundle = build({
	bundle: true,
	entryPoints: [
		path.resolve(
			process.cwd(),
			"src/obsidian-vault-action-manager/impl/opened-file-service.ts",
		),
	],
	external: ["obsidian"],
	format: "cjs",
	platform: "node",
	write: false,
}).then((result) => result.outputFiles[0]?.text ?? "");

describe("OpenedFileService e2e", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("reads active md, reports active view, and returns pwd", async () => {
		const code = await openedFileServiceBundle;
		const result = await browser.executeObsidian(
			async ({ app }, { code }) => {
				const loadModule = (bundle: string) => {
					const module: { exports: Record<string, unknown> } = {
						exports: {},
					};
					// eslint-disable-next-line no-new-func
					const loader = new Function(
						"require",
						"module",
						"exports",
						bundle,
					);
					loader(require, module, module.exports);
					return module.exports;
				};

				const { OpenedFileService, splitPath, splitPathKey } =
					loadModule(code);
				const service = new OpenedFileService(app);

				await app.workspace.openLinkText("Welcome.md", "", false);
				const target = splitPath("Welcome.md");

				const content = await service.readContent(target);
				const pwd = await service.pwd();
				const isActive = await service.isInActiveView(target);

				return {
					content,
					isActive,
					pwd: splitPathKey(pwd),
				};
			},
			{ code },
		);

		expect(result.content.startsWith("This is your vault")).toBe(true);
		expect(result.pwd).toBe("Welcome.md");
		expect(result.isActive).toBe(true);
	});

	it("lists folder children and checks existence", async () => {
		const code = await openedFileServiceBundle;
		const result = await browser.executeObsidian(
			async ({ app }, { code }) => {
				const loadModule = (bundle: string) => {
					const module: { exports: Record<string, unknown> } = {
						exports: {},
					};
					// eslint-disable-next-line no-new-func
					const loader = new Function(
						"require",
						"module",
						"exports",
						bundle,
					);
					loader(require, module, module.exports);
					return module.exports;
				};

				const { OpenedFileService, splitPath, splitPathKey } =
					loadModule(code);
				const service = new OpenedFileService(app);

				await app.vault.createFolder("TempE2E").catch(() => {});
				await app.vault.create("TempE2E/Note.md", "note").catch(() => {});

				const folder = splitPath("TempE2E");
				const file = splitPath("TempE2E/Note.md");
				const missing = splitPath("Missing/Nope.md");

				const listed = await service.list(folder);
				const existsFile = await service.exists(file);
				const existsMissing = await service.exists(missing);

				return {
					existsFile,
					existsMissing,
					listed: listed.map(splitPathKey).sort(),
				};
			},
			{ code },
		);

		expect(result.existsFile).toBe(true);
		expect(result.existsMissing).toBe(false);
		expect(result.listed).toContain("TempE2E/Note.md");
	});
});
