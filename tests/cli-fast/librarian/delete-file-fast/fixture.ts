import type { FastExpectations } from "../../infra";
import { createExactFile, deleteAnyPath, expectFastHealing, waitFor } from "../../infra";

const ROOT = "Library/CliFast/Pie/Fish";

export const FAST_DELETE_FILE_FIXTURE = {
	codexPath: `${ROOT}/__-Fish-Pie-CliFast.md`,
	ingredientsPath: `${ROOT}/Ingredients-Fish-Pie-CliFast.md`,
	rootPath: "Library/CliFast",
	stepsPath: `${ROOT}/Steps-Fish-Pie-CliFast.md`,
};

export const FAST_DELETE_FILE_EXPECTATIONS: FastExpectations = {
	contentChecks: [
		[
			FAST_DELETE_FILE_FIXTURE.codexPath,
			["Steps-Fish-Pie-CliFast"],
		],
	],
	contentMustNotContain: [
		[
			FAST_DELETE_FILE_FIXTURE.codexPath,
			["Ingredients-Fish-Pie-CliFast"],
		],
	],
	files: [
		FAST_DELETE_FILE_FIXTURE.codexPath,
		FAST_DELETE_FILE_FIXTURE.stepsPath,
	],
	goneFiles: [FAST_DELETE_FILE_FIXTURE.ingredientsPath],
};

export async function resetFastDeleteFileFixture(): Promise<void> {
	await deleteAnyPath(FAST_DELETE_FILE_FIXTURE.rootPath);
	await waitFor("short");
}

export async function createFastDeleteFileFixture(): Promise<void> {
	await createExactFile(
		FAST_DELETE_FILE_FIXTURE.ingredientsPath,
		"# Ingredients",
	);
	await createExactFile(FAST_DELETE_FILE_FIXTURE.stepsPath, "# Steps");
	await waitFor("short");
}

export async function expectFastDeleteFileHealing(): Promise<void> {
	await expectFastHealing(FAST_DELETE_FILE_EXPECTATIONS);
}
