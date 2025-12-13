/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testRenameFolder = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		// Basic Happy Path: Rename folder to new name (target doesn't exist)
		const sourceFolderSplitPath = splitPath("source-folder");
		const createSourceResult = await tfolderHelper.createFolder(sourceFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSourceResult.isErr()) {
			throw new Error(createSourceResult.error);
		}

		const targetFolderSplitPath = splitPath("renamed-folder");
		const renameResult = await tfolderHelper.renameFolder({
			from: sourceFolderSplitPath,
			to: targetFolderSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		// Verify source no longer exists, target exists
		const sourceExists = app.vault.getAbstractFileByPath("source-folder") !== null;
		const targetExists = app.vault.getAbstractFileByPath("renamed-folder") !== null;

		const happyPath1 = {
			createOk: createSourceResult.isOk(),
			renameOk: renameResult.isOk(),
			sourceExistsAfterRename: sourceExists,
			targetExistsAfterRename: targetExists,
			targetName: renameResult.value?.name,
			targetPath: renameResult.value?.path,
		};

		// Basic Happy Path: Rename folder to same name (no-op, returns existing)
		const sameNameFolderSplitPath = splitPath("same-name-folder");
		const createSameNameResult = await tfolderHelper.createFolder(sameNameFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSameNameResult.isErr()) {
			throw new Error(createSameNameResult.error);
		}

		const renameSameResult = await tfolderHelper.renameFolder({
			from: sameNameFolderSplitPath,
			to: sameNameFolderSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const sameNameExists = app.vault.getAbstractFileByPath("same-name-folder") !== null;

		const happyPath2 = {
			createOk: createSameNameResult.isOk(),
			fileExistsAfterRename: sameNameExists,
			fileName: renameSameResult.value?.name,
			filePath: renameSameResult.value?.path,
			renameOk: renameSameResult.isOk(),
		};

		// Move: Move folder to different location (target doesn't exist)
		const parentFolderSplitPath = splitPath("parent-move");
		const parentResult = await tfolderHelper.createFolder(parentFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (parentResult.isErr()) {
			throw new Error(parentResult.error);
		}

		const moveSourceSplitPath = splitPath("move-source-folder");
		const createMoveSourceResult = await tfolderHelper.createFolder(moveSourceSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createMoveSourceResult.isErr()) {
			throw new Error(createMoveSourceResult.error);
		}

		const moveTargetSplitPath = splitPath("parent-move/moved-folder");
		const moveResult = await tfolderHelper.renameFolder({
			from: moveSourceSplitPath,
			to: moveTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const moveSourceExists = app.vault.getAbstractFileByPath("move-source-folder") !== null;
		const moveTargetExists = app.vault.getAbstractFileByPath("parent-move/moved-folder") !== null;

		const move1 = {
			createOk: createMoveSourceResult.isOk(),
			moveOk: moveResult.isOk(),
			sourceExistsAfterMove: moveSourceExists,
			targetExistsAfterMove: moveTargetExists,
			targetName: moveResult.value?.name,
			targetPath: moveResult.value?.path,
		};

		// Move: Rename to path with special characters → handles correctly
		const specialCharsSourceSplitPath = splitPath("special-source-folder");
		const createSpecialSourceResult = await tfolderHelper.createFolder(specialCharsSourceSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSpecialSourceResult.isErr()) {
			throw new Error(createSpecialSourceResult.error);
		}

		const specialCharsTargetSplitPath = splitPath("folder-with-!@#$%");
		const specialCharsRenameResult = await tfolderHelper.renameFolder({
			from: specialCharsSourceSplitPath,
			to: specialCharsTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		let specialChars;
		if (specialCharsRenameResult.isOk()) {
			const specialSourceExists = app.vault.getAbstractFileByPath("special-source-folder") !== null;
			specialChars = {
				createOk: createSpecialSourceResult.isOk(),
				renameOk: true,
				sourceExistsAfterRename: specialSourceExists,
				targetName: specialCharsRenameResult.value?.name,
				targetPath: specialCharsRenameResult.value?.path,
			};
		} else {
			specialChars = {
				createOk: createSpecialSourceResult.isOk(),
				error: specialCharsRenameResult.error,
				renameOk: false,
			};
		}

		// Move: Rename across folder boundaries → moves correctly
		const crossBoundaryParent1SplitPath = splitPath("parent1");
		const crossBoundaryParent1Result = await tfolderHelper.createFolder(crossBoundaryParent1SplitPath) as unknown as Result<{ name: string; path: string }>;

		if (crossBoundaryParent1Result.isErr()) {
			throw new Error(crossBoundaryParent1Result.error);
		}

		const crossBoundaryParent2SplitPath = splitPath("parent2");
		const crossBoundaryParent2Result = await tfolderHelper.createFolder(crossBoundaryParent2SplitPath) as unknown as Result<{ name: string; path: string }>;

		if (crossBoundaryParent2Result.isErr()) {
			throw new Error(crossBoundaryParent2Result.error);
		}

		const crossBoundarySourceSplitPath = splitPath("parent1/cross-folder");
		const createCrossBoundarySourceResult = await tfolderHelper.createFolder(crossBoundarySourceSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createCrossBoundarySourceResult.isErr()) {
			throw new Error(createCrossBoundarySourceResult.error);
		}

		const crossBoundaryTargetSplitPath = splitPath("parent2/cross-folder");
		const crossBoundaryResult = await tfolderHelper.renameFolder({
			from: crossBoundarySourceSplitPath,
			to: crossBoundaryTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const crossBoundarySourceExists = app.vault.getAbstractFileByPath("parent1/cross-folder") !== null;
		const crossBoundaryTargetExists = app.vault.getAbstractFileByPath("parent2/cross-folder") !== null;

		const move2 = {
			createOk: createCrossBoundarySourceResult.isOk(),
			moveOk: crossBoundaryResult.isOk(),
			sourceExistsAfterMove: crossBoundarySourceExists,
			targetExistsAfterMove: crossBoundaryTargetExists,
			targetName: crossBoundaryResult.value?.name,
			targetPath: crossBoundaryResult.value?.path,
		};

		// Collision Strategy "skip": Target folder exists → returns target folder, source unchanged
		const skipSourceSplitPath = splitPath("skip-source-folder");
		const createSkipSourceResult = await tfolderHelper.createFolder(skipSourceSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSkipSourceResult.isErr()) {
			throw new Error(createSkipSourceResult.error);
		}

		const skipTargetSplitPath = splitPath("skip-target-folder");
		const createSkipTargetResult = await tfolderHelper.createFolder(skipTargetSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSkipTargetResult.isErr()) {
			throw new Error(createSkipTargetResult.error);
		}

		const skipResult = await tfolderHelper.renameFolder({
			collisionStrategy: "skip",
			from: skipSourceSplitPath,
			to: skipTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const skipSourceExists = app.vault.getAbstractFileByPath("skip-source-folder") !== null;
		const skipTargetExists = app.vault.getAbstractFileByPath("skip-target-folder") !== null;

		const skip1 = {
			createSourceOk: createSkipSourceResult.isOk(),
			createTargetOk: createSkipTargetResult.isOk(),
			renameOk: skipResult.isOk(),
			sourceExistsAfterRename: skipSourceExists,
			targetExistsAfterRename: skipTargetExists,
			targetName: skipResult.value?.name,
			targetPath: skipResult.value?.path,
		};

		// Idempotency: Source doesn't exist, target exists → returns target (assumes already moved)
		const idempotentTargetSplitPath = splitPath("idempotent-target-folder");
		const createIdempotentTargetResult = await tfolderHelper.createFolder(idempotentTargetSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createIdempotentTargetResult.isErr()) {
			throw new Error(createIdempotentTargetResult.error);
		}

		const idempotentSourceSplitPath = splitPath("nonexistent-source-folder");
		const idempotentResult = await tfolderHelper.renameFolder({
			from: idempotentSourceSplitPath,
			to: idempotentTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const idempotent1 = {
			createTargetOk: createIdempotentTargetResult.isOk(),
			renameOk: idempotentResult.isOk(),
			targetName: idempotentResult.value?.name,
			targetPath: idempotentResult.value?.path,
		};

		// Idempotency: Source and target are same folder object → no-op, returns folder
		const sameFolderSplitPath = splitPath("same-folder");
		const createSameFolderResult = await tfolderHelper.createFolder(sameFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createSameFolderResult.isErr()) {
			throw new Error(createSameFolderResult.error);
		}

		const sameFolderRenameResult = await tfolderHelper.renameFolder({
			from: sameFolderSplitPath,
			to: sameFolderSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const idempotent2 = {
			createOk: createSameFolderResult.isOk(),
			filePath: sameFolderRenameResult.value?.path,
			renameOk: sameFolderRenameResult.isOk(),
			samePath: sameFolderRenameResult.value?.path === createSameFolderResult.value?.path,
		};

		// Basic Errors: Both source and target don't exist → returns error
		const bothNonexistentSourceSplitPath = splitPath("nonexistent-source-folder-2");
		const bothNonexistentTargetSplitPath = splitPath("nonexistent-target-folder-2");
		const bothNonexistentResult = await tfolderHelper.renameFolder({
			from: bothNonexistentSourceSplitPath,
			to: bothNonexistentTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const error1 = {
			error: bothNonexistentResult.isErr() ? bothNonexistentResult.error : undefined,
			isErr: bothNonexistentResult.isErr(),
		};

		return {
			error1,
			happyPath1,
			happyPath2,
			idempotent1,
			idempotent2,
			move1,
			move2,
			skip1,
			specialChars,
		};
	});

	// Basic Happy Path assertions
	expect(results.happyPath1.createOk).toBe(true);
	expect(results.happyPath1.renameOk).toBe(true);
	expect(results.happyPath1.sourceExistsAfterRename).toBe(false);
	expect(results.happyPath1.targetExistsAfterRename).toBe(true);
	expect(results.happyPath1.targetName).toBe("renamed-folder");
	expect(results.happyPath1.targetPath).toBe("renamed-folder");

	expect(results.happyPath2.createOk).toBe(true);
	expect(results.happyPath2.renameOk).toBe(true);
	expect(results.happyPath2.fileExistsAfterRename).toBe(true);
	expect(results.happyPath2.fileName).toBe("same-name-folder");
	expect(results.happyPath2.filePath).toBe("same-name-folder");

	// Move assertions
	expect(results.move1.createOk).toBe(true);
	expect(results.move1.moveOk).toBe(true);
	expect(results.move1.sourceExistsAfterMove).toBe(false);
	expect(results.move1.targetExistsAfterMove).toBe(true);
	expect(results.move1.targetName).toBe("moved-folder");
	expect(results.move1.targetPath).toBe("parent-move/moved-folder");

	expect(results.move2.createOk).toBe(true);
	expect(results.move2.moveOk).toBe(true);
	expect(results.move2.sourceExistsAfterMove).toBe(false);
	expect(results.move2.targetExistsAfterMove).toBe(true);
	expect(results.move2.targetName).toBe("cross-folder");
	expect(results.move2.targetPath).toBe("parent2/cross-folder");

	// Special characters: Obsidian's behavior is golden source
	if (results.specialChars.renameOk) {
		expect(results.specialChars.sourceExistsAfterRename).toBe(false);
		expect(results.specialChars.targetName).toBeDefined();
		expect(results.specialChars.targetPath).toBeDefined();
	} else {
		expect(results.specialChars.error).toBeDefined();
	}

	// Collision Strategy "skip" assertions
	expect(results.skip1.createSourceOk).toBe(true);
	expect(results.skip1.createTargetOk).toBe(true);
	expect(results.skip1.renameOk).toBe(true);
	expect(results.skip1.sourceExistsAfterRename).toBe(true);
	expect(results.skip1.targetExistsAfterRename).toBe(true);
	expect(results.skip1.targetName).toBe("skip-target-folder");

	// Idempotency assertions
	expect(results.idempotent1.createTargetOk).toBe(true);
	expect(results.idempotent1.renameOk).toBe(true);
	expect(results.idempotent1.targetName).toBe("idempotent-target-folder");
	expect(results.idempotent1.targetPath).toBe("idempotent-target-folder");

	expect(results.idempotent2.createOk).toBe(true);
	expect(results.idempotent2.renameOk).toBe(true);
	expect(results.idempotent2.samePath).toBe(true);

	// Basic Errors assertions
	expect(results.error1.isErr).toBe(true);
	expect(results.error1.error).toBeDefined();
};
