import { createFile, obsidian, waitForIdle } from "../../../../utils";
import { obsidianEval } from "../../../../utils/cli";
import {
	MOVED_SCROLL_DESTINATION_FOLDER,
	MOVED_SCROLL_INITIAL_PATH,
} from "./vault-expectations";

export async function performMutation011(): Promise<void> {
	const destination = MOVED_SCROLL_DESTINATION_FOLDER.replace(/'/g, "\\'");
	await obsidianEval(
		`(async()=>{if(!app.vault.getAbstractFileByPath('${destination}'))await app.vault.createFolder('${destination}');return 'ok'})()`,
	);
	await waitForIdle();

	await createFile(MOVED_SCROLL_INITIAL_PATH, "# CLI moved scroll");
	await waitForIdle();

	await obsidian(
		`move path="${MOVED_SCROLL_INITIAL_PATH}" to="${MOVED_SCROLL_DESTINATION_FOLDER}"`,
	);
}
