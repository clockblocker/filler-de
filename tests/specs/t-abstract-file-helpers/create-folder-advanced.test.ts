/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateFolderAdvanced = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfolderHelper, splitPath } = api;

		// Idempotency: Create folder that already exists
		const existingFolderSplitPath = splitPath("existing-folder");
		const createResult1 = await tfolderHelper.createFolder(existingFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createResult1.isErr()) {
			throw new Error(createResult1.error);
		}

		const firstPath = createResult1.value?.path;
		const firstName = createResult1.value?.name;

		// Create again (should return existing)
		const createResult2 = await tfolderHelper.createFolder(existingFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createResult2.isErr()) {
			throw new Error(createResult2.error);
		}

		const secondPath = createResult2.value?.path;
		const secondName = createResult2.value?.name;

		const idempotent1 = {
			firstCreateOk: createResult1.isOk(),
			namesMatch: firstName === secondName,
			pathsMatch: firstPath === secondPath,
			secondCreateOk: createResult2.isOk(),
		};

		// Idempotency: Multiple creates of same folder
		const multiCreateSplitPath = splitPath("multi-create-folder");
		const create1 = await tfolderHelper.createFolder(multiCreateSplitPath) as unknown as Result<{ name: string; path: string }>;
		const create2 = await tfolderHelper.createFolder(multiCreateSplitPath) as unknown as Result<{ name: string; path: string }>;
		const create3 = await tfolderHelper.createFolder(multiCreateSplitPath) as unknown as Result<{ name: string; path: string }>;

		const idempotent2 = {
			allOk: create1.isOk() && create2.isOk() && create3.isOk(),
			allSamePath: create1.value?.path === create2.value?.path && create2.value?.path === create3.value?.path,
		};

		// Nested Folders: Create nested folder (parent exists)
		const parentSplitPath = splitPath("parent-folder");
		const parentResult = await tfolderHelper.createFolder(parentSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (parentResult.isErr()) {
			throw new Error(parentResult.error);
		}

		const nestedSplitPath = splitPath("parent-folder/nested-folder");
		const nestedResult = await tfolderHelper.createFolder(nestedSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (nestedResult.isErr()) {
			throw new Error(nestedResult.error);
		}

		// Verify nested folder exists
		const getNestedResult = await tfolderHelper.getFolder(nestedSplitPath) as unknown as Result<{ name: string; path: string }>;

		const nested1 = {
			getNestedOk: getNestedResult.isOk(),
			nestedCreateOk: nestedResult.isOk(),
			nestedName: nestedResult.value?.name,
			nestedPath: nestedResult.value?.path,
			parentCreateOk: parentResult.isOk(),
		};

		// Nested Folders: Parent folder doesn't exist
		// Obsidian's vault.createFolder automatically creates parent folders
		const noParentSplitPath = splitPath("nonexistent-parent/child-folder");
		const noParentResult = await tfolderHelper.createFolder(noParentSplitPath) as unknown as Result<{ name: string; path: string }>;

		// Verify parent was created automatically
		const parentCheckSplitPath = splitPath("nonexistent-parent");
		const parentCheckResult = await tfolderHelper.getFolder(parentCheckSplitPath) as unknown as Result<{ name: string; path: string }>;

		const nested2 = {
			childCreated: noParentResult.isOk(),
			childName: noParentResult.value?.name,
			childPath: noParentResult.value?.path,
			parentAutoCreated: parentCheckResult.isOk(),
			parentName: parentCheckResult.value?.name,
			parentPath: parentCheckResult.value?.path,
		};

		// Special Characters: Create folder with special characters in name
		const specialCharsSplitPath = splitPath("folder-with-special-chars-!@#$%");
		const specialCharsResult = await tfolderHelper.createFolder(specialCharsSplitPath) as unknown as Result<{ name: string; path: string }>;

		// Race Conditions: Multiple concurrent creates → one succeeds, others get existing
		const raceFolderSplitPath = splitPath("race-folder");
		
		// Create folder 3 times concurrently
		const [raceCreate1, raceCreate2, raceCreate3] = await Promise.all([
			tfolderHelper.createFolder(raceFolderSplitPath) as unknown as Promise<Result<{ name: string; path: string }>>,
			tfolderHelper.createFolder(raceFolderSplitPath) as unknown as Promise<Result<{ name: string; path: string }>>,
			tfolderHelper.createFolder(raceFolderSplitPath) as unknown as Promise<Result<{ name: string; path: string }>>,
		]);

		const raceConcurrent = {
			allOk: raceCreate1.isOk() && raceCreate2.isOk() && raceCreate3.isOk(),
			allSamePath: raceCreate1.value?.path === raceCreate2.value?.path && raceCreate2.value?.path === raceCreate3.value?.path,
			path1: raceCreate1.value?.path,
			path2: raceCreate2.value?.path,
			path3: raceCreate3.value?.path,
		};

		// Race Conditions: Folder created between check and create → handles gracefully
		// Simulate by creating folder externally, then trying to create again
		const externalFolderSplitPath = splitPath("external-race-folder");
		
		// Create folder using Obsidian API directly (external creation)
		await app.vault.createFolder("external-race-folder");
		
		// Now try to create via helper (should return existing)
		const createAfterExternal = await tfolderHelper.createFolder(externalFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		const raceExternal = {
			isOk: createAfterExternal.isOk(),
			path: createAfterExternal.value?.path,
		};

		if (specialCharsResult.isErr()) {
			// Some special chars might be invalid, that's ok
			const specialChars1 = {
				error: specialCharsResult.error,
				isErr: true,
			};

			// Try with more common special chars
			const commonSpecialSplitPath = splitPath("folder-with-dashes_and_underscores");
			const commonSpecialResult = await tfolderHelper.createFolder(commonSpecialSplitPath) as unknown as Result<{ name: string; path: string }>;

			return {
				idempotent1,
				idempotent2,
				nested1,
				nested2,
				raceConcurrent,
				raceExternal,
				specialChars1,
				specialChars2: {
					createOk: commonSpecialResult.isOk(),
					folderName: commonSpecialResult.value?.name,
					folderPath: commonSpecialResult.value?.path,
				},
			};
		}

		const specialChars1 = {
			createOk: specialCharsResult.isOk(),
			folderName: specialCharsResult.value?.name,
			folderPath: specialCharsResult.value?.path,
		};

		// Try with spaces (common special case)
		const spacesSplitPath = splitPath("folder with spaces");
		const spacesResult = await tfolderHelper.createFolder(spacesSplitPath) as unknown as Result<{ name: string; path: string }>;

		return {
			idempotent1,
			idempotent2,
			nested1,
			nested2,
			raceConcurrent,
			raceExternal,
			specialChars1,
			specialChars2: {
				createOk: spacesResult.isOk(),
				folderName: spacesResult.value?.name,
				folderPath: spacesResult.value?.path,
			},
		};
	});

	// Idempotency assertions
	expect(results.idempotent1.firstCreateOk).toBe(true);
	expect(results.idempotent1.secondCreateOk).toBe(true);
	expect(results.idempotent1.pathsMatch).toBe(true);
	expect(results.idempotent1.namesMatch).toBe(true);

	expect(results.idempotent2.allOk).toBe(true);
	expect(results.idempotent2.allSamePath).toBe(true);

	// Nested Folders assertions
	expect(results.nested1.parentCreateOk).toBe(true);
	expect(results.nested1.nestedCreateOk).toBe(true);
	expect(results.nested1.getNestedOk).toBe(true);
	expect(results.nested1.nestedName).toBe("nested-folder");
	expect(results.nested1.nestedPath).toBe("parent-folder/nested-folder");

	// Parent doesn't exist: Obsidian auto-creates parent folders
	expect(results.nested2.childCreated).toBe(true);
	expect(results.nested2.childName).toBe("child-folder");
	expect(results.nested2.childPath).toBe("nonexistent-parent/child-folder");
	expect(results.nested2.parentAutoCreated).toBe(true);
	expect(results.nested2.parentName).toBe("nonexistent-parent");
	expect(results.nested2.parentPath).toBe("nonexistent-parent");

	// Special Characters assertions
	// At least one special char test should succeed
	const isSpecialCharsError = "isErr" in results.specialChars1 && results.specialChars1.isErr;
	if (isSpecialCharsError) {
		// Some special chars are invalid, that's expected
		expect(results.specialChars1.error).toBeDefined();
		// But common special chars should work
		expect(results.specialChars2.createOk).toBe(true);
		expect(results.specialChars2.folderName).toBeDefined();
	} else {
		// TypeScript now knows this is the success case
		const specialChars1Success = results.specialChars1 as { createOk: boolean; folderName: string | undefined; folderPath: string | undefined; };
		expect(specialChars1Success.createOk).toBe(true);
		expect(specialChars1Success.folderName).toBeDefined();
		expect(results.specialChars2.createOk).toBe(true);
		expect(results.specialChars2.folderName).toBeDefined();
	}

	// Race Conditions assertions
	// Verify concurrent creates all succeed and return same folder
	expect(results.raceConcurrent.allOk).toBe(true);
	expect(results.raceConcurrent.allSamePath).toBe(true);
	expect(results.raceConcurrent.path1).toBe("race-folder");

	// Verify external creation is handled gracefully
	expect(results.raceExternal.isOk).toBe(true);
	expect(results.raceExternal.path).toBe("external-race-folder");
};
