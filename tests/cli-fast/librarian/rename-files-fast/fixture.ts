import type { FastExpectations } from "../../infra";
import {
	createExactBinaryFile,
	createExactFile,
	deleteAnyPath,
	expectFastHealing,
	renameAnyPath,
	waitFor,
} from "../../infra";

const ROOT = "Library/CliFast/RenameFiles/Recipe";

export const FAST_RENAME_FILES_FIXTURE = {
	berryCodexPath: `${ROOT}/Pie/Berry/__-Berry-Pie-Recipe-RenameFiles-CliFast.md`,
	berryFolderPath: `${ROOT}/Berry_Pie`,
	berryHealedPaths: [
		`${ROOT}/Pie/Berry/Ingredients-Berry-Pie-Recipe-RenameFiles-CliFast.md`,
		`${ROOT}/Pie/Berry/Steps-Berry-Pie-Recipe-RenameFiles-CliFast.md`,
		`${ROOT}/Pie/Berry/Result_picture-Berry-Pie-Recipe-RenameFiles-CliFast.jpg`,
	] as const,
	fishFolderPath: `${ROOT}/Fish-Pie`,
	fishHealedPaths: [
		`${ROOT}/Pie/Fish/Ingredients-Fish-Pie-Recipe-RenameFiles-CliFast.md`,
		`${ROOT}/Pie/Fish/Steps-Fish-Pie-Recipe-RenameFiles-CliFast.md`,
		`${ROOT}/Pie/Fish/Result_picture-Fish-Pie-Recipe-RenameFiles-CliFast.jpg`,
	] as const,
	fishCodexPath: `${ROOT}/Pie/Fish/__-Fish-Pie-Recipe-RenameFiles-CliFast.md`,
	pieCodexPath: `${ROOT}/Pie/__-Pie-Recipe-RenameFiles-CliFast.md`,
	pieFolderPath: `${ROOT}/Pie`,
	recipeCodexPath: `${ROOT}/__-Recipe-RenameFiles-CliFast.md`,
	rootCodexPath: "Library/CliFast/RenameFiles/__-RenameFiles-CliFast.md",
	rootPath: "Library/CliFast/RenameFiles",
};

export const FAST_RENAME_FILES_EXPECTATIONS: FastExpectations = {
	contentChecks: [
		[
			FAST_RENAME_FILES_FIXTURE.recipeCodexPath,
			["[[__-Pie-Recipe-RenameFiles-CliFast|Pie]]"],
		],
		[
			FAST_RENAME_FILES_FIXTURE.pieCodexPath,
			[
				"[[__-Berry-Pie-Recipe-RenameFiles-CliFast|Berry]]",
				"[[__-Fish-Pie-Recipe-RenameFiles-CliFast|Fish]]",
			],
		],
	],
	folderSnapshot: {
		exactCodexes: [
			FAST_RENAME_FILES_FIXTURE.rootCodexPath,
			FAST_RENAME_FILES_FIXTURE.recipeCodexPath,
			FAST_RENAME_FILES_FIXTURE.pieCodexPath,
			FAST_RENAME_FILES_FIXTURE.berryCodexPath,
			FAST_RENAME_FILES_FIXTURE.fishCodexPath,
		],
		files: [
			FAST_RENAME_FILES_FIXTURE.rootCodexPath,
			FAST_RENAME_FILES_FIXTURE.recipeCodexPath,
			FAST_RENAME_FILES_FIXTURE.pieCodexPath,
			FAST_RENAME_FILES_FIXTURE.berryCodexPath,
			FAST_RENAME_FILES_FIXTURE.fishCodexPath,
			...FAST_RENAME_FILES_FIXTURE.berryHealedPaths,
			...FAST_RENAME_FILES_FIXTURE.fishHealedPaths,
		],
		folder: FAST_RENAME_FILES_FIXTURE.rootPath,
		goneFiles: [
			`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/__-Berry_Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Ingredients-Berry_Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Steps-Berry_Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Result_picture-Berry_Pie-Recipe-RenameFiles-CliFast.jpg`,
			`${FAST_RENAME_FILES_FIXTURE.fishFolderPath}/__-Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.fishFolderPath}/Ingredients-Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.fishFolderPath}/Steps-Pie-Recipe-RenameFiles-CliFast.md`,
			`${FAST_RENAME_FILES_FIXTURE.fishFolderPath}/Result_picture-Pie-Recipe-RenameFiles-CliFast.jpg`,
		],
	},
};

export async function resetFastRenameFilesFixture(): Promise<void> {
	await deleteAnyPath(FAST_RENAME_FILES_FIXTURE.rootPath);
	await waitFor("short");
}

export async function createFastRenameFilesFixture(): Promise<void> {
	await createExactFile(
		`${FAST_RENAME_FILES_FIXTURE.pieFolderPath}/Ingredients.md`,
		"# Ingredients",
	);
	await createExactFile(
		`${FAST_RENAME_FILES_FIXTURE.pieFolderPath}/Steps.md`,
		"# Steps",
	);
	await createExactBinaryFile(
		`${FAST_RENAME_FILES_FIXTURE.pieFolderPath}/Result_picture.jpg`,
	);
	await createExactFile(
		`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Ingredients.md`,
		"# Ingredients",
	);
	await createExactFile(
		`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Steps.md`,
		"# Steps",
	);
	await createExactBinaryFile(
		`${FAST_RENAME_FILES_FIXTURE.berryFolderPath}/Result_picture.jpg`,
	);
	await waitFor("long");
}

export async function performFastRenameFilesMutation(): Promise<void> {
	await renameAnyPath(
		FAST_RENAME_FILES_FIXTURE.pieFolderPath,
		FAST_RENAME_FILES_FIXTURE.fishFolderPath,
	);
	await waitFor("long");
	await renameAnyPath(
		FAST_RENAME_FILES_FIXTURE.berryFolderPath,
		`${ROOT}/Berry-Pie`,
	);
	await waitFor("medium-long");
}

export async function expectFastRenameFilesHealing(): Promise<void> {
	await expectFastHealing(FAST_RENAME_FILES_EXPECTATIONS);
}
