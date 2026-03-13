import type { FastExpectations } from "../../infra";
import {
	createExactFile,
	deleteAnyPath,
	expectFastHealing,
	renameExactFile,
	waitFor,
} from "../../infra";

const ROOT = "Library/CliFast/RenameCorename/Soup/Ramen";

export const FAST_RENAME_CORENAME_FIXTURE = {
	codexPath: `${ROOT}/__-Ramen-Soup-RenameCorename-CliFast.md`,
	draftPath: `${ROOT}/Draft-Ramen-Soup-RenameCorename-CliFast.md`,
	finalName: "Final-Ramen-Soup-RenameCorename-CliFast.md",
	finalPath: `${ROOT}/Final-Ramen-Soup-RenameCorename-CliFast.md`,
	originalPath: `${ROOT}/Untitled.md`,
	reviewPath: `${ROOT}/Review-Ramen-Soup-RenameCorename-CliFast.md`,
	rootPath: "Library/CliFast/RenameCorename",
	untitledHealedPath: `${ROOT}/Untitled-Ramen-Soup-RenameCorename-CliFast.md`,
};

export const FAST_RENAME_CORENAME_EXPECTATIONS: FastExpectations = {
	contentChecks: [
		[
			FAST_RENAME_CORENAME_FIXTURE.codexPath,
			["[[Final-Ramen-Soup-RenameCorename-CliFast|Final]]"],
		],
	],
	contentMustNotContain: [
		[
			FAST_RENAME_CORENAME_FIXTURE.codexPath,
			["Untitled", "Draft", "Review"],
		],
	],
	files: [
		FAST_RENAME_CORENAME_FIXTURE.codexPath,
		FAST_RENAME_CORENAME_FIXTURE.finalPath,
	],
	goneFiles: [
		FAST_RENAME_CORENAME_FIXTURE.originalPath,
		FAST_RENAME_CORENAME_FIXTURE.untitledHealedPath,
		FAST_RENAME_CORENAME_FIXTURE.draftPath,
		FAST_RENAME_CORENAME_FIXTURE.reviewPath,
	],
};

export async function resetFastRenameCorenameFixture(): Promise<void> {
	await deleteAnyPath(FAST_RENAME_CORENAME_FIXTURE.rootPath);
	await waitFor("short");
}

export async function createFastRenameCorenameFixture(): Promise<void> {
	await createExactFile(
		FAST_RENAME_CORENAME_FIXTURE.originalPath,
		"# Untitled note content",
	);
	await waitFor("long");
}

export async function performFastRenameCorenameMutation(): Promise<void> {
	await renameExactFile(
		FAST_RENAME_CORENAME_FIXTURE.untitledHealedPath,
		"Draft-Ramen-Soup-RenameCorename-CliFast.md",
	);
	await waitFor("medium-long");
	await renameExactFile(
		FAST_RENAME_CORENAME_FIXTURE.draftPath,
		"Review-Ramen-Soup-RenameCorename-CliFast.md",
	);
	await waitFor("medium-long");
	await renameExactFile(
		FAST_RENAME_CORENAME_FIXTURE.reviewPath,
		FAST_RENAME_CORENAME_FIXTURE.finalName,
	);
	await waitFor("long");
}

export async function expectFastRenameCorenameHealing(): Promise<void> {
	await expectFastHealing(FAST_RENAME_CORENAME_EXPECTATIONS);
}
