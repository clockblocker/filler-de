import type { FastExpectations } from "../../infra";
import {
	createExactFile,
	deleteAnyPath,
	expectFastHealing,
	waitFor,
} from "../../infra";

const ROOT = "Library/CliFast/BasenameHealing/Soup/Ramen";

export const FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE = {
	codexPath: `${ROOT}/__-Ramen-Soup-BasenameHealing-CliFast.md`,
	healedPath: `${ROOT}/NewScroll-Ramen-Soup-BasenameHealing-CliFast.md`,
	originalPath: `${ROOT}/NewScroll.md`,
	rootPath: "Library/CliFast/BasenameHealing",
};

export const FAST_CREATE_FILE_BASENAME_HEALING_EXPECTATIONS: FastExpectations =
	{
		contentChecks: [
			[
				FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.codexPath,
				["[[NewScroll-Ramen-Soup-BasenameHealing-CliFast|NewScroll]]"],
			],
			[
				FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.healedPath,
				["[[__-Ramen-Soup-BasenameHealing-CliFast|← Ramen]]"],
			],
		],
		contentMustNotContain: [
			[
				FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.healedPath,
				["]] \n[[__-Ramen-Soup-BasenameHealing-CliFast"],
			],
		],
		files: [
			FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.codexPath,
			FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.healedPath,
		],
		goneFiles: [FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.originalPath],
	};

export async function resetFastCreateFileBasenameHealingFixture(): Promise<void> {
	await deleteAnyPath(FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.rootPath);
	await waitFor("short");
}

export async function createFastCreateFileBasenameHealingFixture(): Promise<void> {
	await createExactFile(
		FAST_CREATE_FILE_BASENAME_HEALING_FIXTURE.originalPath,
		"# NewScroll\n\nThis is a new scroll without suffix.",
	);
	await waitFor("long");
}

export async function expectFastCreateFileBasenameHealing(): Promise<void> {
	await expectFastHealing(FAST_CREATE_FILE_BASENAME_HEALING_EXPECTATIONS);
}
