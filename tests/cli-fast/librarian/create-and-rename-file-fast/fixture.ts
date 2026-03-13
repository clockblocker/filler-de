import type { FastExpectations } from "../../infra";
import {
	createExactFile,
	deleteAnyPath,
	expectFastHealing,
	waitFor,
} from "../../infra";

const ROOT = "Library/CliFast/CreateAndRename/Pie/Berry";

export const FAST_CREATE_AND_RENAME_FILE_FIXTURE = {
	codexPath: `${ROOT}/__-Berry-Pie-CreateAndRename-CliFast.md`,
	originalPath: `${ROOT}/MyNote-Berry-Pie-CreateAndRename-CliFast.md`,
	renamedName: "Renamed-Berry-Pie-CreateAndRename-CliFast.md",
	renamedPath: `${ROOT}/Renamed-Berry-Pie-CreateAndRename-CliFast.md`,
	rootPath: "Library/CliFast/CreateAndRename",
};

export const FAST_CREATE_AND_RENAME_FILE_EXPECTATIONS: FastExpectations = {
	contentChecks: [
		[
			FAST_CREATE_AND_RENAME_FILE_FIXTURE.codexPath,
			["Renamed-Berry-Pie-CreateAndRename-CliFast|Renamed"],
		],
	],
	contentMustNotContain: [
		[
			FAST_CREATE_AND_RENAME_FILE_FIXTURE.codexPath,
			["MyNote-Berry-Pie-CreateAndRename-CliFast|MyNote"],
		],
	],
	files: [
		FAST_CREATE_AND_RENAME_FILE_FIXTURE.codexPath,
		FAST_CREATE_AND_RENAME_FILE_FIXTURE.renamedPath,
	],
	goneFiles: [FAST_CREATE_AND_RENAME_FILE_FIXTURE.originalPath],
};

export async function resetFastCreateAndRenameFileFixture(): Promise<void> {
	await deleteAnyPath(FAST_CREATE_AND_RENAME_FILE_FIXTURE.rootPath);
	await waitFor("short");
}

export async function createFastCreateAndRenameFileFixture(): Promise<void> {
	await createExactFile(
		FAST_CREATE_AND_RENAME_FILE_FIXTURE.originalPath,
		"# New scroll content",
	);
	await waitFor("short");
}

export async function expectFastCreateAndRenameFileHealing(): Promise<void> {
	await expectFastHealing(FAST_CREATE_AND_RENAME_FILE_EXPECTATIONS);
}
