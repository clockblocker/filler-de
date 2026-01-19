/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import { Notice } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { OpenedFileService } from "../../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import { logError } from "../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { parseSeparatedSuffix } from "../codecs/internal/suffix/parse";
import { makeCodecRulesFromSettings } from "../codecs/rules";
import {
	buildPageSplitActions,
	buildTooShortMetadataAction,
} from "./build-actions";
import { segmentContent } from "./segmenter";
import type { SegmentationConfig } from "./types";
import { DEFAULT_SEGMENTATION_CONFIG } from "./types";

/**
 * Context required for split-to-pages action.
 */
export type SplitToPagesContext = {
	openedFileService: OpenedFileService;
	vaultActionManager: VaultActionManager;
};

/**
 * Executes the split-to-pages action on the currently opened file.
 */
export async function splitToPagesAction(
	context: SplitToPagesContext,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): Promise<void> {
	const { openedFileService, vaultActionManager } = context;

	try {
		// 1. Get current file path
		const pwdResult = await openedFileService.pwd();
		if (pwdResult.isErr()) {
			logError({
				description: `Failed to get current file path: ${pwdResult.error}`,
				location: "splitToPagesAction",
			});
			new Notice("Failed to get current file");
			return;
		}
		const sourcePath: SplitPathToMdFile = pwdResult.value;

		// 2. Get file content
		const contentResult = await openedFileService.getContent();
		if (contentResult.isErr()) {
			logError({
				description: `Failed to get file content: ${contentResult.error}`,
				location: "splitToPagesAction",
			});
			new Notice("Failed to read file content");
			return;
		}
		const content = contentResult.value;

		// 3. Parse basename to get coreName and suffix
		const settings = getParsedUserSettings();
		const rules = makeCodecRulesFromSettings(settings);

		const basenameParseResult = parseSeparatedSuffix(
			rules,
			sourcePath.basename,
		);
		if (basenameParseResult.isErr()) {
			logError({
				description: `Failed to parse basename: ${basenameParseResult.error.message}`,
				location: "splitToPagesAction",
			});
			new Notice("Failed to parse file name");
			return;
		}
		const basenameInfo = basenameParseResult.value;

		// 4. Segment content
		const segmentationResult = segmentContent(
			content,
			basenameInfo,
			config,
		);

		// 5. Handle too-short content
		if (segmentationResult.tooShortToSplit) {
			new Notice("File is too short to split - adding Page metadata");
			const action = buildTooShortMetadataAction(sourcePath);
			const dispatchResult = await vaultActionManager.dispatch([action]);
			if (dispatchResult.isErr()) {
				logError({
					description: `Failed to add metadata: ${dispatchResult.error}`,
					location: "splitToPagesAction",
				});
			}
			return;
		}

		// 6. Build and dispatch vault actions
		const actions = buildPageSplitActions(
			segmentationResult,
			sourcePath,
			rules,
		);

		const dispatchResult = await vaultActionManager.dispatch(actions);
		if (dispatchResult.isErr()) {
			logError({
				description: `Failed to split file: ${dispatchResult.error}`,
				location: "splitToPagesAction",
			});
			new Notice("Failed to split file into pages");
			return;
		}

		new Notice(`Split into ${segmentationResult.pages.length} pages`);
	} catch (error) {
		logError({
			description: `Error in splitToPagesAction: ${error instanceof Error ? error.message : String(error)}`,
			location: "splitToPagesAction",
		});
		new Notice("An error occurred while splitting");
	}
}
