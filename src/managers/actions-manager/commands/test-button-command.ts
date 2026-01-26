/**
 * TestButton command - demo command for testing overlay toolbar.
 */

import { logger } from "../../../utils/logger";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

/**
 * Payload for TestButton command.
 */
export type TestButtonPayload = {
	filePath: SplitPathToMdFile;
};

/**
 * Execute the test button command.
 * Logs the file path to demonstrate the toolbar button works.
 */
export function testButtonCommand(payload: TestButtonPayload): void {
	const pathString = [
		...payload.filePath.segments,
		`${payload.filePath.basename}.${payload.filePath.extension}`,
	].join("/");

	logger.info(`[TestButton] Clicked for file: ${pathString}`);
}
