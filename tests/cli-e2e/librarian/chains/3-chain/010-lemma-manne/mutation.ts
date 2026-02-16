import { existsSync } from "node:fs";
import {
	copyLocalFileToVault,
	executeCommandOnSelection,
	fileExists,
	waitForIdle,
} from "../../../../utils";
import {
	LEMMA_COMMAND_ID,
	LEMMA_SELECTED_TEXT,
	SOURCE_ASCHENPUTTEL_PAGE_PATH,
	TARGET_ASCHENPUTTEL_HEALED_PAGE_PATH,
	TARGET_ASCHENPUTTEL_RAW_PAGE_PATH,
} from "./vault-expectations";

async function resolveTargetPagePath(): Promise<string> {
	if (await fileExists(TARGET_ASCHENPUTTEL_RAW_PAGE_PATH)) {
		return TARGET_ASCHENPUTTEL_RAW_PAGE_PATH;
	}
	if (await fileExists(TARGET_ASCHENPUTTEL_HEALED_PAGE_PATH)) {
		return TARGET_ASCHENPUTTEL_HEALED_PAGE_PATH;
	}
	throw new Error(
		`Aschenputtel page not found at raw or healed path: ${TARGET_ASCHENPUTTEL_RAW_PAGE_PATH}`,
	);
}

export async function performMutation010(): Promise<void> {
	if (!existsSync(SOURCE_ASCHENPUTTEL_PAGE_PATH)) {
		throw new Error(
			`Source page not found: ${SOURCE_ASCHENPUTTEL_PAGE_PATH}. Set CLI_E2E_SOURCE_PAGE_PATH if needed.`,
		);
	}

	await copyLocalFileToVault(
		SOURCE_ASCHENPUTTEL_PAGE_PATH,
		TARGET_ASCHENPUTTEL_RAW_PAGE_PATH,
	);
	await waitForIdle(20_000);

	const targetPath = await resolveTargetPagePath();

	await executeCommandOnSelection({
		commandId: LEMMA_COMMAND_ID,
		path: targetPath,
		selectedText: LEMMA_SELECTED_TEXT,
	});
}
