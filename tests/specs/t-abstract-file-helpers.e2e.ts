/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";


// Why inline? browser.executeObsidian serializes functions and runs them in the Obsidian context, so external functions aren't accessible. The helper must be defined inside the callback.
type HelpersTestingApi = {
	tfileHelper: {
		getFile: (p: unknown) => Promise<unknown>;
		createMdFile: (p: unknown) => Promise<unknown>;
	};
	tfolderHelper: {
		getFolder: (p: unknown) => Promise<unknown>;
		createFolder: (p: unknown) => Promise<unknown>;
	};
	splitPath: (input: string) => unknown;
};

type Result<T> = {
	isErr: () => boolean;
	isOk: () => boolean;
	error?: string;
	value?: T;
};

describe("TFileHelper and TFolderHelper", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await app.commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	it("should create and get a folder", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			const getHelpersApi = () => {
				const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
					getHelpersTestingApi?: () => HelpersTestingApi;
				};
				const api = plugin.getHelpersTestingApi?.();
				if (!api) throw new Error("testing api unavailable");
				return api;
			};
			const asResult = <T>(r: unknown): Result<T> => r as Result<T>;
			const { tfolderHelper, splitPath } = getHelpersApi();

			const folderSplitPath = splitPath("test-folder");
			const createResult = asResult<{ name: string; path: string }>(
				await tfolderHelper.createFolder(folderSplitPath),
			);

			if (createResult.isErr()) {
				return { error: createResult.error };
			}

			const getResult = asResult<{ name: string; path: string }>(
				await tfolderHelper.getFolder(folderSplitPath),
			);

			if (getResult.isErr()) {
				return { error: getResult.error };
			}

			return {
				folderName: getResult.value?.name,
				folderPath: getResult.value?.path,
				success: true,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.success).toBe(true);
		expect(result.folderName).toBe("test-folder");
		expect(result.folderPath).toBe("test-folder");
	});

	it("should create and get a markdown file", async () => {
		const result = await browser.executeObsidian(async ({ app }) => {
			const getHelpersApi = () => {
				const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
					getHelpersTestingApi?: () => HelpersTestingApi;
				};
				const api = plugin.getHelpersTestingApi?.();
				if (!api) throw new Error("testing api unavailable");
				return api;
			};
			
			const asResult = <T>(r: unknown): Result<T> => r as Result<T>;
			const { tfileHelper, splitPath } = getHelpersApi();

			const fileSplitPath = splitPath("test-file.md");
			const createResult = asResult<{ name: string; path: string }>(
				await tfileHelper.createMdFile({
					content: "# Test Content",
					splitPath: fileSplitPath,
				}),
			);

			if (createResult.isErr()) {
				return { error: createResult.error };
			}

			const getResult = asResult<{ name: string; path: string }>(
				await tfileHelper.getFile(fileSplitPath),
			);

			if (getResult.isErr()) {
				return { error: getResult.error };
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const content = await app.vault.read(getResult.value as any);

			return {
				content,
				fileName: getResult.value?.name,
				filePath: getResult.value?.path,
				success: true,
			};
		});

		expect(result.error).toBeUndefined();
		expect(result.success).toBe(true);
		expect(result.fileName).toBe("test-file.md");
		expect(result.filePath).toBe("test-file.md");
		expect(result.content).toBe("# Test Content");
	});
});
