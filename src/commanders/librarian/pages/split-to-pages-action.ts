/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "@textfresser/library-core";
import {
	type CodecRules,
	makeCodecRulesFromSettings,
	parseSeparatedSuffix,
} from "@textfresser/library-core";
import { goBackLinkHelper } from "@textfresser/note-addressing";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import type {
	VamEffectError,
	VaultActionManager,
} from "@textfresser/vault-action-manager/facade";
import { Effect } from "effect";
import { Notice } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import { describeLibrarianVamFailure } from "../commands/vam-failure";
import { buildPageSplitActions } from "./build-actions";
import {
	handleSplitToPagesError,
	makeSplitToPagesError,
	type SplitToPagesError,
} from "./error";
import { segmentContent, segmentContentWithBlockMarkers } from "./segmenter";
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

export type SplitToPagesContext<E = never> = {
	vam: VaultActionManager;
	/** Called after pages are created, bypasses self-event filtering */
	onSectionCreated?: (info: SplitHealingInfo) => Effect.Effect<void, E>;
};

type SplitInput = {
	sourcePath: SplitPathToMdFile;
	content: string;
	rules: CodecRules;
	segmentation: SegmentationResult;
};

// ─── Core Logic ───

const gatherInput = Effect.fn("Librarian.splitToPages.gatherInput")(function* (
	context: SplitToPagesContext<unknown>,
	config: SegmentationConfig,
): Effect.fn.Return<SplitInput, SplitToPagesError> {
	const sourcePath = yield* context.vam
		.mdPwd()
		.pipe(
			Effect.mapError((error) =>
				makeSplitToPagesError.noPwd(describeLibrarianVamFailure(error)),
			),
		);
	if (!sourcePath) {
		return yield* Effect.fail(
			makeSplitToPagesError.noPwd("Active file is not a markdown file"),
		);
	}

	const content = yield* context.vam
		.getOpenedContent()
		.pipe(
			Effect.mapError((error) =>
				makeSplitToPagesError.noContent(
					describeLibrarianVamFailure(error),
				),
			),
		);

	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);

	const basenameResult = parseSeparatedSuffix(rules, sourcePath.basename);
	if (basenameResult.isErr()) {
		return yield* Effect.fail(
			makeSplitToPagesError.parseFailed(basenameResult.error.message),
		);
	}

	// Strip go-back links before segmentation
	const cleanContent = goBackLinkHelper.strip(content);
	const segmentation = segmentContentWithBlockMarkers(
		cleanContent,
		basenameResult.value,
		config,
	);

	return { content, rules, segmentation, sourcePath };
});

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

const executeDispatch = Effect.fn("Librarian.splitToPages.executeDispatch")(
	function* (
		vam: VaultActionManager,
		input: SplitInput,
	): Effect.fn.Return<DispatchResult, SplitToPagesError> {
		const { sourcePath, rules, segmentation } = input;

		if (segmentation.tooShortToSplit) {
			return { tooShort: true };
		}

		const {
			actions,
			deletedScrollSegmentId,
			firstPagePath,
			pageNodeNames,
			sectionChain,
		} = buildPageSplitActions(segmentation, sourcePath, rules);
		yield* vam
			.dispatch(actions)
			.pipe(
				Effect.mapError((error) =>
					makeSplitToPagesError.dispatchFailed(
						describeLibrarianVamFailure(error, actions),
					),
				),
			);

		return {
			deletedScrollSegmentId,
			firstPagePath,
			pageCount: segmentation.pages.length,
			pageNodeNames,
			sectionChain,
			tooShort: false,
		};
	},
);

// ─── Public API ───

export const splitToPagesAction = Effect.fn("Librarian.splitToPagesAction")(
	function* <E>(
		context: SplitToPagesContext<E>,
		config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
	): Effect.fn.Return<void, SplitToPagesError | VamEffectError | E> {
		const input = yield* gatherInput(context, config).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => handleSplitToPagesError(error)),
			),
		);

		const result = yield* executeDispatch(context.vam, input).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => handleSplitToPagesError(error)),
			),
		);
		if (result.tooShort) {
			// Should not happen because UI only exposes the action for multi-page content.
			return;
		}

		// Notify Librarian about the new section (bypasses self-event filtering)
		if (context.onSectionCreated) {
			yield* context.onSectionCreated({
				deletedScrollSegmentId: result.deletedScrollSegmentId,
				pageNodeNames: result.pageNodeNames,
				sectionChain: result.sectionChain,
			});
		}

		yield* Effect.sync(
			() => new Notice(`Split into ${result.pageCount} pages`),
		);
		yield* context.vam.cd(result.firstPagePath);
	},
);

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
