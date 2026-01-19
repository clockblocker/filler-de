/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import { Notice } from "obsidian";
import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { OpenedFileService } from "../../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import { logError } from "../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { parseSeparatedSuffix } from "../codecs/internal/suffix/parse";
import type { CodecRules } from "../codecs/rules";
import { makeCodecRulesFromSettings } from "../codecs/rules";
import {
	buildPageSplitActions,
	buildTooShortMetadataAction,
} from "./build-actions";
import { segmentContent } from "./segmenter";
import type { SegmentationConfig, SegmentationResult } from "./types";
import { DEFAULT_SEGMENTATION_CONFIG } from "./types";

// ─── Types ───

export type SplitToPagesContext = {
	openedFileService: OpenedFileService;
	vaultActionManager: VaultActionManager;
};

type SplitToPagesError =
	| { kind: "NoPwd"; reason: string }
	| { kind: "NoContent"; reason: string }
	| { kind: "ParseFailed"; reason: string }
	| { kind: "DispatchFailed"; reason: string };

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
		return err({ kind: "NoPwd", reason: String(pwdResult.error) });
	}
	const sourcePath = pwdResult.value;

	const contentResult = await openedFileService.getContent();
	if (contentResult.isErr()) {
		return err({ kind: "NoContent", reason: String(contentResult.error) });
	}
	const content = contentResult.value;

	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);

	const basenameResult = parseSeparatedSuffix(rules, sourcePath.basename);
	if (basenameResult.isErr()) {
		return err({
			kind: "ParseFailed",
			reason: basenameResult.error.message,
		});
	}

	const segmentation = segmentContent(content, basenameResult.value, config);

	return ok({ sourcePath, content, rules, segmentation });
}

async function executeDispatch(
	vaultActionManager: VaultActionManager,
	input: SplitInput,
): Promise<Result<number, SplitToPagesError>> {
	const { sourcePath, rules, segmentation } = input;

	if (segmentation.tooShortToSplit) {
		const action = buildTooShortMetadataAction(sourcePath);
		const result = await vaultActionManager.dispatch([action]);
		if (result.isErr()) {
			return err({
				kind: "DispatchFailed",
				reason: String(result.error),
			});
		}
		return ok(0); // 0 = too short, metadata added
	}

	const actions = buildPageSplitActions(segmentation, sourcePath, rules);
	const result = await vaultActionManager.dispatch(actions);
	if (result.isErr()) {
		return err({ kind: "DispatchFailed", reason: String(result.error) });
	}

	return ok(segmentation.pages.length);
}

// ─── Error Handling ───

const ERROR_MESSAGES: Record<SplitToPagesError["kind"], string> = {
	NoPwd: "Failed to get current file",
	NoContent: "Failed to read file content",
	ParseFailed: "Failed to parse file name",
	DispatchFailed: "Failed to split file into pages",
};

function handleError(error: SplitToPagesError): void {
	logError({
		description: `${error.kind}: ${error.reason}`,
		location: "splitToPagesAction",
	});
	new Notice(ERROR_MESSAGES[error.kind]);
}

// ─── Public API ───

export async function splitToPagesAction(
	context: SplitToPagesContext,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): Promise<void> {
	const inputResult = await gatherInput(context, config);
	if (inputResult.isErr()) {
		handleError(inputResult.error);
		return;
	}

	const dispatchResult = await executeDispatch(
		context.vaultActionManager,
		inputResult.value,
	);
	if (dispatchResult.isErr()) {
		handleError(dispatchResult.error);
		return;
	}

	const pageCount = dispatchResult.value;
	if (pageCount === 0) {
		new Notice("File is too short to split - adding Page metadata");
	} else {
		new Notice(`Split into ${pageCount} pages`);
	}
}
