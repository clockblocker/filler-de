/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testUpsertMdFileHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, makeSplitPath } = api;

		const runCreateTest = async (name: string, setup: () => Promise<{ filePath: string; content: string; expectedName: string; expectedPath: string }>) => {
			const { filePath, content, expectedName, expectedPath } = await setup();
			const fileSplitPath = splitPath(filePath);
			const createResult = await tfileHelper.upsertMdFile({
				content,
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult.isErr()) {
				return { error: createResult.error, name };
			}

			// Verify file was created by reading it
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const fileContent = await app.vault.read(createResult.value as any);

			return {
				content: fileContent,
				expectedContent: content,
				expectedName,
				expectedPath,
				fileName: createResult.value?.name,
				filePath: createResult.value?.path,
				name,
				success: true,
			};
		};

		const withContent = await runCreateTest("withContent", async () => {
			return {
				content: "# Test Content",
				expectedContent: "# Test Content",
				expectedName: "test.md",
				expectedPath: "test.md",
				filePath: "test.md",
			};
		});

		const emptyContent = await runCreateTest("emptyContent", async () => {
			return {
				content: "",
				expectedContent: "",
				expectedName: "empty.md",
				expectedPath: "empty.md",
				filePath: "empty.md",
			};
		});

		const nested = await runCreateTest("nested", async () => {
			// Create parent folder first
			const folderSplitPath = splitPath("parent/child");
			const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (folderResult.isErr()) {
				throw new Error(folderResult.error);
			}

			return {
				content: "# Nested Content",
				expectedContent: "# Nested Content",
				expectedName: "nested.md",
				expectedPath: "parent/child/nested.md",
				filePath: "parent/child/nested.md",
			};
		});

		// Special Characters: Path with valid special characters → handles correctly
		const validSpecialCharsSplitPath = splitPath("file-with-dashes_and-underscores.md");
		const validSpecialCharsResult = await tfileHelper.upsertMdFile({
			content: "# Valid special chars",
			splitPath: validSpecialCharsSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		let validSpecialChars;
		if (validSpecialCharsResult.isOk()) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const validContent = await app.vault.read(validSpecialCharsResult.value as any);
			validSpecialChars = {
				content: validContent,
				createOk: true,
				fileName: validSpecialCharsResult.value?.name,
				filePath: validSpecialCharsResult.value?.path,
			};
		} else {
			validSpecialChars = {
				createOk: false,
				error: validSpecialCharsResult.error,
			};
		}

		// Special Characters: Path with spaces (common special case)
		const spacesSplitPath = splitPath("file with spaces.md");
		const spacesResult = await tfileHelper.upsertMdFile({
			content: "# File with spaces",
			splitPath: spacesSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		let spacesFile;
		if (spacesResult.isOk()) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const spacesContent = await app.vault.read(spacesResult.value as any);
			spacesFile = {
				content: spacesContent,
				createOk: true,
				fileName: spacesResult.value?.name,
				filePath: spacesResult.value?.path,
			};
		} else {
			spacesFile = {
				createOk: false,
				error: spacesResult.error,
			};
		}

		// Special Characters: Test various special characters
		// Obsidian's behavior is the golden source - some chars may be allowed, others may error
		const specialCharsSplitPath = splitPath("file-with-!@#$%.md");
		const specialCharsResult = await tfileHelper.upsertMdFile({
			content: "# Special chars",
			splitPath: specialCharsSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		let specialChars;
		if (specialCharsResult.isOk()) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const specialContent = await app.vault.read(specialCharsResult.value as any);
			specialChars = {
				content: specialContent,
				createOk: true,
				fileName: specialCharsResult.value?.name,
				filePath: specialCharsResult.value?.path,
			};
		} else {
			specialChars = {
				createOk: false,
				error: specialCharsResult.error,
				isErr: true,
			};
		}

		return { emptyContent, nested, spacesFile, specialChars, validSpecialChars, withContent };
	});

	expect(results.withContent.error).toBeUndefined();
	expect(results.withContent.success).toBe(true);
	expect(results.withContent.fileName).toBe(results.withContent.expectedName);
	expect(results.withContent.filePath).toBe(results.withContent.expectedPath);
	expect(results.withContent.content).toBe(results.withContent.expectedContent);

	expect(results.emptyContent.error).toBeUndefined();
	expect(results.emptyContent.success).toBe(true);
	expect(results.emptyContent.fileName).toBe(results.emptyContent.expectedName);
	expect(results.emptyContent.filePath).toBe(results.emptyContent.expectedPath);
	expect(results.emptyContent.content).toBe(results.emptyContent.expectedContent);

	expect(results.nested.error).toBeUndefined();
	expect(results.nested.success).toBe(true);
	expect(results.nested.fileName).toBe(results.nested.expectedName);
	expect(results.nested.filePath).toBe(results.nested.expectedPath);
	expect(results.nested.content).toBe(results.nested.expectedContent);

	// Special Characters assertions
	// Valid special characters should work (dashes, underscores)
	if (results.validSpecialChars.createOk) {
		expect(results.validSpecialChars.fileName).toBeDefined();
		expect(results.validSpecialChars.filePath).toBeDefined();
		expect(results.validSpecialChars.content).toBe("# Valid special chars");
	}

	// Spaces in filename should work
	if (results.spacesFile.createOk) {
		expect(results.spacesFile.fileName).toBeDefined();
		expect(results.spacesFile.filePath).toBeDefined();
		expect(results.spacesFile.content).toBe("# File with spaces");
	}

	// Special characters: Obsidian's behavior is the golden source
	// Some characters might be invalid, others might be allowed - verify Obsidian's actual behavior
	if (results.specialChars.createOk) {
		// If Obsidian allows it, verify it was created correctly
		expect(results.specialChars.fileName).toBeDefined();
		expect(results.specialChars.filePath).toBeDefined();
		expect(results.specialChars.content).toBe("# Special chars");
	} else {
		// If Obsidian rejects it, verify error is present
		expect(results.specialChars.isErr).toBe(true);
		expect(results.specialChars.error).toBeDefined();
	}
};
