/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import { err, ok, type Result } from "neverthrow";
import { Notice } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { ActiveFileService } from "../../../managers/obsidian/vault-action-manager/file-services/active-view/active-file-service";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link/go-back-link";
import { parseSeparatedSuffix } from "../codecs/internal/suffix/parse";
import type { CodecRules } from "../codecs/rules";
import { makeCodecRulesFromSettings } from "../codecs/rules";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../codecs/segment-id/types/segment-id";
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

/** Info about the split operation for Librarian healing */
export type SplitHealingInfo = {
	/** Section chain for the newly created folder */
	sectionChain: SectionNodeSegmentId[];
	/** Segment ID of the deleted scroll (to remove from tree) */
	deletedScrollSegmentId: ScrollNodeSegmentId;
	/** Node names of created pages (e.g., "Aschenputtel_Page_000") */
	pageNodeNames: string[];
};

export type SplitToPagesContext = {
	activeFileService: ActiveFileService;
	vam: VaultActionManager;
	/** Called after pages are created, bypasses self-event filtering */
	onSectionCreated?: (info: SplitHealingInfo) => void;
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
	const { activeFileService } = context;

	const pwdResult = await activeFileService.pwd();
	if (pwdResult.isErr()) {
		return err(makeSplitToPagesError.noPwd(String(pwdResult.error)));
	}
	const maybePath = pwdResult.value;
	if (maybePath.kind !== "MdFile") {
		return err(
			makeSplitToPagesError.noPwd("Active file is not a markdown file"),
		);
	}
	const sourcePath = maybePath;

	const contentResult = await activeFileService.getContent();
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

	// Strip go-back links before segmentation
	const cleanContent = goBackLinkHelper.strip(content);
	const segmentation = segmentContent(
		cleanContent,
		basenameResult.value,
		config,
	);

	return ok({ content, rules, segmentation, sourcePath });
}

type DispatchResult =
	| { tooShort: true }
	| {
			tooShort: false;
			pageCount: number;
			firstPagePath: SplitPathToMdFile;
			sectionChain: SectionNodeSegmentId[];
			deletedScrollSegmentId: ScrollNodeSegmentId;
			pageNodeNames: string[];
	  };

async function executeDispatch(
	vam: VaultActionManager,
	input: SplitInput,
): Promise<Result<DispatchResult, SplitToPagesError>> {
	const { sourcePath, rules, segmentation } = input;

	if (segmentation.tooShortToSplit) {
		const action = buildTooShortMetadataAction(sourcePath);
		const result = await vam.dispatch([action]);
		if (result.isErr()) {
			return err(
				makeSplitToPagesError.dispatchFailed(String(result.error)),
			);
		}
		return ok({ tooShort: true });
	}

	const {
		actions,
		deletedScrollSegmentId,
		firstPagePath,
		pageNodeNames,
		sectionChain,
	} = buildPageSplitActions(segmentation, sourcePath, rules);
	const result = await vam.dispatch(actions);
	if (result.isErr()) {
		return err(makeSplitToPagesError.dispatchFailed(String(result.error)));
	}

	return ok({
		deletedScrollSegmentId,
		firstPagePath,
		pageCount: segmentation.pages.length,
		pageNodeNames,
		sectionChain,
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
		context.vam,
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

	// Notify Librarian about the new section (bypasses self-event filtering)
	if (context.onSectionCreated) {
		context.onSectionCreated({
			deletedScrollSegmentId: result.deletedScrollSegmentId,
			pageNodeNames: result.pageNodeNames,
			sectionChain: result.sectionChain,
		});
	}

	new Notice(`Split into ${result.pageCount} pages`);
	await context.activeFileService.cd(result.firstPagePath);
}

/**
 * Quick check if content would segment into multiple pages.
 * Useful for UI decisions (e.g., showing "Split into pages" menu item).
 */
export function wouldSplitToMultiplePages(
	content: string,
	basename: string,
	rules: CodecRules,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): boolean {
	const basenameResult = parseSeparatedSuffix(rules, basename);
	if (basenameResult.isErr()) return false;

	const cleanContent = goBackLinkHelper.strip(content);
	const result = segmentContent(cleanContent, basenameResult.value, config);
	return result.pages.length > 1;
}
