/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import { err, ok, type Result } from "neverthrow";
import { Notice } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { OpenedFileService } from "../../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { parseSeparatedSuffix } from "../codecs/internal/suffix/parse";
import type { CodecRules } from "../codecs/rules";
import { makeCodecRulesFromSettings } from "../codecs/rules";
import {
	buildPageSplitActions,
	buildTooShortMetadataAction,
} from "./build-actions";
import {
	handleSplitToPagesError,
	makeSplitToPagesError,
	type SplitToPagesError,
} from "./error";
import { segmentContent } from "./segmenter";
import type { SegmentationConfig, SegmentationResult } from "./types";
import { DEFAULT_SEGMENTATION_CONFIG } from "./types";

// ─── Types ───

export type SplitToPagesContext = {
	openedFileService: OpenedFileService;
	vaultActionManager: VaultActionManager;
};

type SplitInput = {
	sourcePath: SplitPathToMdFile;
	content: string;
	rules: CodecRules;
	segmentation: SegmentationResult;
};

// ─── Core Logic ───

async function gatherInput(
	context: SplitToPagesContext,
	config: SegmentationConfig,
): Promise<Result<SplitInput, SplitToPagesError>> {
	const { openedFileService } = context;

	const pwdResult = await openedFileService.pwd();
	if (pwdResult.isErr()) {
		return err(makeSplitToPagesError.noPwd(String(pwdResult.error)));
	}
	const sourcePath = pwdResult.value;

	const contentResult = await openedFileService.getContent();
	if (contentResult.isErr()) {
		return err(
			makeSplitToPagesError.noContent(String(contentResult.error)),
		);
	}
	const content = contentResult.value;

	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);

	const basenameResult = parseSeparatedSuffix(rules, sourcePath.basename);
	if (basenameResult.isErr()) {
		return err(
			makeSplitToPagesError.parseFailed(basenameResult.error.message),
		);
	}

	const segmentation = segmentContent(content, basenameResult.value, config);

	return ok({ content, rules, segmentation, sourcePath });
}

type DispatchResult =
	| { tooShort: true }
	| { tooShort: false; pageCount: number; firstPagePath: SplitPathToMdFile };

async function executeDispatch(
	vaultActionManager: VaultActionManager,
	input: SplitInput,
): Promise<Result<DispatchResult, SplitToPagesError>> {
	const { sourcePath, rules, segmentation } = input;

	if (segmentation.tooShortToSplit) {
		const action = buildTooShortMetadataAction(sourcePath);
		const result = await vaultActionManager.dispatch([action]);
		if (result.isErr()) {
			return err(
				makeSplitToPagesError.dispatchFailed(String(result.error)),
			);
		}
		return ok({ tooShort: true });
	}

	const { actions, firstPagePath } = buildPageSplitActions(
		segmentation,
		sourcePath,
		rules,
	);
	const result = await vaultActionManager.dispatch(actions);
	if (result.isErr()) {
		return err(makeSplitToPagesError.dispatchFailed(String(result.error)));
	}

	return ok({
		firstPagePath,
		pageCount: segmentation.pages.length,
		tooShort: false,
	});
}

// ─── Public API ───

export async function splitToPagesAction(
	context: SplitToPagesContext,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): Promise<void> {
	const inputResult = await gatherInput(context, config);
	if (inputResult.isErr()) {
		handleSplitToPagesError(inputResult.error);
		return;
	}

	const dispatchResult = await executeDispatch(
		context.vaultActionManager,
		inputResult.value,
	);
	if (dispatchResult.isErr()) {
		handleSplitToPagesError(dispatchResult.error);
		return;
	}

	const result = dispatchResult.value;
	if (result.tooShort) {
		// Should not happen. We only show button for 2+ pages.
		// If user still invokes the command, we just add metadata.
		// Invoking the command on an already split page is idempotent.
		return;
	}

	new Notice(`Split into ${result.pageCount} pages`);
	await context.openedFileService.cd(result.firstPagePath);
}
