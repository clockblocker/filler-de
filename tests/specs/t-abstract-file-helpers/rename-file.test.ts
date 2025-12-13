/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testRenameFile = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		// Basic Happy Path: Rename file to new name (target doesn't exist)
		const sourceFileSplitPath = splitPath("source-file.md");
		const createSourceResult = await tfileHelper.createMdFile({
			content: "# Source content",
			splitPath: sourceFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSourceResult.isErr()) {
			throw new Error(createSourceResult.error);
		}

		const targetFileSplitPath = splitPath("renamed-file.md");
		const renameResult = await tfileHelper.renameFile({
			from: sourceFileSplitPath,
			to: targetFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		// Verify source no longer exists, target exists
		const sourceExists = app.vault.getAbstractFileByPath("source-file.md") !== null;
		const targetExists = app.vault.getAbstractFileByPath("renamed-file.md") !== null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const targetContent = await app.vault.read(renameResult.value as any);

		const happyPath1 = {
			createOk: createSourceResult.isOk(),
			renameOk: renameResult.isOk(),
			sourceExistsAfterRename: sourceExists,
			targetContent,
			targetExistsAfterRename: targetExists,
			targetName: renameResult.value?.name,
			targetPath: renameResult.value?.path,
		};

		// Basic Happy Path: Rename file to same name (no-op, returns existing)
		const sameNameFileSplitPath = splitPath("same-name.md");
		const createSameNameResult = await tfileHelper.createMdFile({
			content: "# Same name",
			splitPath: sameNameFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSameNameResult.isErr()) {
			throw new Error(createSameNameResult.error);
		}

		const renameSameResult = await tfileHelper.renameFile({
			from: sameNameFileSplitPath,
			to: sameNameFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const sameNameExists = app.vault.getAbstractFileByPath("same-name.md") !== null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const sameNameContent = await app.vault.read(renameSameResult.value as any);

		const happyPath2 = {
			createOk: createSameNameResult.isOk(),
			fileContent: sameNameContent,
			fileExistsAfterRename: sameNameExists,
			fileName: renameSameResult.value?.name,
			filePath: renameSameResult.value?.path,
			renameOk: renameSameResult.isOk(),
		};

		// Move Across Folders: Move file to different folder (target doesn't exist)
		const folderSplitPath = splitPath("move-folder");
		const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (folderResult.isErr()) {
			throw new Error(folderResult.error);
		}

		const moveSourceSplitPath = splitPath("move-source.md");
		const createMoveSourceResult = await tfileHelper.createMdFile({
			content: "# Move me",
			splitPath: moveSourceSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createMoveSourceResult.isErr()) {
			throw new Error(createMoveSourceResult.error);
		}

		const moveTargetSplitPath = splitPath("move-folder/moved-file.md");
		const moveResult = await tfileHelper.renameFile({
			from: moveSourceSplitPath,
			to: moveTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const moveSourceExists = app.vault.getAbstractFileByPath("move-source.md") !== null;
		const moveTargetExists = app.vault.getAbstractFileByPath("move-folder/moved-file.md") !== null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const moveTargetContent = await app.vault.read(moveResult.value as any);

		const move1 = {
			createOk: createMoveSourceResult.isOk(),
			moveOk: moveResult.isOk(),
			sourceExistsAfterMove: moveSourceExists,
			targetContent: moveTargetContent,
			targetExistsAfterMove: moveTargetExists,
			targetName: moveResult.value?.name,
			targetPath: moveResult.value?.path,
		};

		// Move Across Folders: Rename to path with special characters → handles correctly
		const specialCharsSourceSplitPath = splitPath("special-source.md");
		const createSpecialSourceResult = await tfileHelper.createMdFile({
			content: "# Special source",
			splitPath: specialCharsSourceSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSpecialSourceResult.isErr()) {
			throw new Error(createSpecialSourceResult.error);
		}

		const specialCharsTargetSplitPath = splitPath("file-with-!@#$%.md");
		const specialCharsRenameResult = await tfileHelper.renameFile({
			from: specialCharsSourceSplitPath,
			to: specialCharsTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		let specialChars;
		if (specialCharsRenameResult.isOk()) {
			const specialSourceExists = app.vault.getAbstractFileByPath("special-source.md") !== null;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const specialContent = await app.vault.read(specialCharsRenameResult.value as any);
			specialChars = {
				createOk: createSpecialSourceResult.isOk(),
				renameOk: true,
				sourceExistsAfterRename: specialSourceExists,
				targetContent: specialContent,
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

		// Collision Strategy "skip": Target exists → returns target file, source unchanged
		const skipSourceSplitPath = splitPath("skip-source.md");
		const createSkipSourceResult = await tfileHelper.createMdFile({
			content: "# Skip source",
			splitPath: skipSourceSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSkipSourceResult.isErr()) {
			throw new Error(createSkipSourceResult.error);
		}

		const skipTargetSplitPath = splitPath("skip-target.md");
		const createSkipTargetResult = await tfileHelper.createMdFile({
			content: "# Skip target",
			splitPath: skipTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSkipTargetResult.isErr()) {
			throw new Error(createSkipTargetResult.error);
		}

		const skipResult = await tfileHelper.renameFile({
			collisionStrategy: "skip",
			from: skipSourceSplitPath,
			to: skipTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const skipSourceExists = app.vault.getAbstractFileByPath("skip-source.md") !== null;
		const skipTargetExists = app.vault.getAbstractFileByPath("skip-target.md") !== null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const skipTargetContent = await app.vault.read(skipResult.value as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const skipSourceContent = await app.vault.read(app.vault.getAbstractFileByPath("skip-source.md") as any);

		const skip1 = {
			createSourceOk: createSkipSourceResult.isOk(),
			createTargetOk: createSkipTargetResult.isOk(),
			renameOk: skipResult.isOk(),
			sourceContent: skipSourceContent,
			sourceExistsAfterRename: skipSourceExists,
			targetContent: skipTargetContent,
			targetExistsAfterRename: skipTargetExists,
			targetName: skipResult.value?.name,
			targetPath: skipResult.value?.path,
		};

		// Collision Strategy "skip": Target exists with different content → returns target, source unchanged
		const skipDiffSourceSplitPath = splitPath("skip-diff-source.md");
		const createSkipDiffSourceResult = await tfileHelper.createMdFile({
			content: "# Different source",
			splitPath: skipDiffSourceSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSkipDiffSourceResult.isErr()) {
			throw new Error(createSkipDiffSourceResult.error);
		}

		const skipDiffTargetSplitPath = splitPath("skip-diff-target.md");
		const createSkipDiffTargetResult = await tfileHelper.createMdFile({
			content: "# Different target",
			splitPath: skipDiffTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSkipDiffTargetResult.isErr()) {
			throw new Error(createSkipDiffTargetResult.error);
		}

		const skipDiffResult = await tfileHelper.renameFile({
			collisionStrategy: "skip",
			from: skipDiffSourceSplitPath,
			to: skipDiffTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const skipDiffSourceExists = app.vault.getAbstractFileByPath("skip-diff-source.md") !== null;
		const skipDiffTargetExists = app.vault.getAbstractFileByPath("skip-diff-target.md") !== null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const skipDiffTargetContent = await app.vault.read(skipDiffResult.value as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const skipDiffSourceContent = await app.vault.read(app.vault.getAbstractFileByPath("skip-diff-source.md") as any);

		const skip2 = {
			createSourceOk: createSkipDiffSourceResult.isOk(),
			createTargetOk: createSkipDiffTargetResult.isOk(),
			renameOk: skipDiffResult.isOk(),
			sourceContent: skipDiffSourceContent,
			sourceExistsAfterRename: skipDiffSourceExists,
			targetContent: skipDiffTargetContent,
			targetExistsAfterRename: skipDiffTargetExists,
			targetName: skipDiffResult.value?.name,
			targetPath: skipDiffResult.value?.path,
		};

		// Idempotency: Source doesn't exist, target exists → returns target (assumes already moved)
		const idempotentTargetSplitPath = splitPath("idempotent-target.md");
		const createIdempotentTargetResult = await tfileHelper.createMdFile({
			content: "# Idempotent target",
			splitPath: idempotentTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createIdempotentTargetResult.isErr()) {
			throw new Error(createIdempotentTargetResult.error);
		}

		const idempotentSourceSplitPath = splitPath("nonexistent-source.md");
		const idempotentResult = await tfileHelper.renameFile({
			from: idempotentSourceSplitPath,
			to: idempotentTargetSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const idempotent1 = {
			createTargetOk: createIdempotentTargetResult.isOk(),
			renameOk: idempotentResult.isOk(),
			targetName: idempotentResult.value?.name,
			targetPath: idempotentResult.value?.path,
		};

		// Idempotency: Source and target are same file object → no-op, returns file
		// (Already tested in happyPath2, but verifying explicitly)
		const sameFileSplitPath = splitPath("same-file.md");
		const createSameFileResult = await tfileHelper.createMdFile({
			content: "# Same file",
			splitPath: sameFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createSameFileResult.isErr()) {
			throw new Error(createSameFileResult.error);
		}

		const sameFileRenameResult = await tfileHelper.renameFile({
			from: sameFileSplitPath,
			to: sameFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const idempotent2 = {
			createOk: createSameFileResult.isOk(),
			filePath: sameFileRenameResult.value?.path,
			renameOk: sameFileRenameResult.isOk(),
			samePath: sameFileRenameResult.value?.path === createSameFileResult.value?.path,
		};

		// Basic Errors: Both source and target don't exist → returns error
		const bothNonexistentSourceSplitPath = splitPath("nonexistent-source-2.md");
		const bothNonexistentTargetSplitPath = splitPath("nonexistent-target-2.md");
		const bothNonexistentResult = await tfileHelper.renameFile({
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
			skip1,
			skip2,
			specialChars,
		};
	});

	// Basic Happy Path assertions
	expect(results.happyPath1.createOk).toBe(true);
	expect(results.happyPath1.renameOk).toBe(true);
	expect(results.happyPath1.sourceExistsAfterRename).toBe(false);
	expect(results.happyPath1.targetExistsAfterRename).toBe(true);
	expect(results.happyPath1.targetContent).toBe("# Source content");
	expect(results.happyPath1.targetName).toBe("renamed-file.md");
	expect(results.happyPath1.targetPath).toBe("renamed-file.md");

	expect(results.happyPath2.createOk).toBe(true);
	expect(results.happyPath2.renameOk).toBe(true);
	expect(results.happyPath2.fileExistsAfterRename).toBe(true);
	expect(results.happyPath2.fileContent).toBe("# Same name");
	expect(results.happyPath2.fileName).toBe("same-name.md");
	expect(results.happyPath2.filePath).toBe("same-name.md");

	// Move Across Folders assertions
	expect(results.move1.createOk).toBe(true);
	expect(results.move1.moveOk).toBe(true);
	expect(results.move1.sourceExistsAfterMove).toBe(false);
	expect(results.move1.targetExistsAfterMove).toBe(true);
	expect(results.move1.targetContent).toBe("# Move me");
	expect(results.move1.targetName).toBe("moved-file.md");
	expect(results.move1.targetPath).toBe("move-folder/moved-file.md");

	// Special characters: Obsidian's behavior is golden source
	if (results.specialChars.renameOk) {
		expect(results.specialChars.sourceExistsAfterRename).toBe(false);
		expect(results.specialChars.targetName).toBeDefined();
		expect(results.specialChars.targetPath).toBeDefined();
		expect(results.specialChars.targetContent).toBe("# Special source");
	} else {
		expect(results.specialChars.error).toBeDefined();
	}

	// Collision Strategy "skip" assertions
	expect(results.skip1.createSourceOk).toBe(true);
	expect(results.skip1.createTargetOk).toBe(true);
	expect(results.skip1.renameOk).toBe(true);
	expect(results.skip1.sourceExistsAfterRename).toBe(true);
	expect(results.skip1.targetExistsAfterRename).toBe(true);
	expect(results.skip1.sourceContent).toBe("# Skip source");
	expect(results.skip1.targetContent).toBe("# Skip target");
	expect(results.skip1.targetName).toBe("skip-target.md");

	expect(results.skip2.createSourceOk).toBe(true);
	expect(results.skip2.createTargetOk).toBe(true);
	expect(results.skip2.renameOk).toBe(true);
	expect(results.skip2.sourceExistsAfterRename).toBe(true);
	expect(results.skip2.targetExistsAfterRename).toBe(true);
	expect(results.skip2.sourceContent).toBe("# Different source");
	expect(results.skip2.targetContent).toBe("# Different target");

	// Idempotency assertions
	expect(results.idempotent1.createTargetOk).toBe(true);
	expect(results.idempotent1.renameOk).toBe(true);
	expect(results.idempotent1.targetName).toBe("idempotent-target.md");
	expect(results.idempotent1.targetPath).toBe("idempotent-target.md");

	expect(results.idempotent2.createOk).toBe(true);
	expect(results.idempotent2.renameOk).toBe(true);
	expect(results.idempotent2.samePath).toBe(true);

	// Basic Errors assertions
	expect(results.error1.isErr).toBe(true);
	expect(results.error1.error).toBeDefined();
};
