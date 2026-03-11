import { createFile, obsidian, waitForIdle } from "../../../../utils";
import {
	MOVED_SCROLL_DESTINATION_FOLDER,
	MOVED_SCROLL_INITIAL_PATH,
} from "./vault-expectations";

export async function performMutation011(): Promise<void> {
	await createFile(MOVED_SCROLL_INITIAL_PATH, "# CLI moved scroll");
	await waitForIdle();

	await obsidian(
		`move path="${MOVED_SCROLL_INITIAL_PATH}" to="${MOVED_SCROLL_DESTINATION_FOLDER}"`,
	);
}
