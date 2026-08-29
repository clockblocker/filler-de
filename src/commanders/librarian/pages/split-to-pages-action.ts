/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import {
	type CodecRules,
	makeCodecRulesFromSettings,
	parseSeparatedSuffix,
} from "@textfresser/library-core";
import { goBackLinkHelper } from "@textfresser/note-addressing";
import type {
	SplitPathToMdFile,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { Notice } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import { describeLibrarianVamFailure } from "../commands/vam-failure";
import type {
	Librarian,
	LibrarianReconciliationOutcome,
	LibraryCommandIntentionResult,
} from "../librarian";
import { buildPageSplitActions } from "./build-actions";
import {
	handleSplitToPagesError,
	makeSplitToPagesError,
	type SplitToPagesError,
} from "./error";
import { segmentContent, segmentContentWithBlockMarkers } from "./segmenter";
import type { SegmentationConfig, SegmentationResult } from "./types";
import { DEFAULT_SEGMENTATION_CONFIG } from "./types";

export type { SplitToPagesError } from "./error";

// ─── Types ───

type SplitToPagesContext = {
	librarian: Librarian;
	vam: Pick<VaultActionManager, "cd" | "getOpenedContent" | "mdPwd">;
};

export type SplitToPagesOutcome =
	| { readonly kind: "TooShort" }
	| {
			readonly initialDispatch: Extract<
				LibraryCommandIntentionResult,
				{ kind: "Completed" }
			>["initialDispatch"];
			readonly kind: "Completed";
			readonly navigation: {
				readonly kind: "Completed";
				readonly path: SplitPathToMdFile;
			};
			readonly operationId: string;
			readonly reconciliation: LibrarianReconciliationOutcome;
	  };

type SplitInput = {
	sourcePath: SplitPathToMdFile;
	rules: CodecRules;
	segmentation: SegmentationResult;
};

// ─── Core Logic ───

const gatherInput = Effect.fn("Librarian.splitToPages.gatherInput")(function* (
	context: SplitToPagesContext,
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

	return { rules, segmentation, sourcePath };
});

type SplitExecutionResult =
	| { tooShort: true }
	| {
			execution: Extract<
				LibraryCommandIntentionResult,
				{ kind: "Completed" }
			>;
			tooShort: false;
			pageCount: number;
			firstPagePath: SplitPathToMdFile;
	  };

const executeIntention = Effect.fn("Librarian.splitToPages.executeIntention")(
	function* (
		context: SplitToPagesContext,
		input: SplitInput,
	): Effect.fn.Return<SplitExecutionResult, SplitToPagesError> {
		const { sourcePath, rules, segmentation } = input;

		if (segmentation.tooShortToSplit) {
			return { tooShort: true };
		}

		const plan = buildPageSplitActions(segmentation, sourcePath, rules);
		if (plan.isErr()) {
			return yield* Effect.fail(
				makeSplitToPagesError.intentionFailed(
					`Source path is outside the configured Library: ${plan.error.path.pathParts.join("/")}/${plan.error.path.basename}`,
				),
			);
		}

		const execution = yield* context.librarian
			.executeSplitIntention(plan.value)
			.pipe(
				Effect.mapError(() =>
					makeSplitToPagesError.librarianUnavailable(
						"Library reconciliation is not initialized",
					),
				),
			);
		const { operationId } = execution;

		if (execution.kind === "VaultDispatchFailed") {
			const dispatchKind = execution.outcome.dispatch.kind;
			return yield* Effect.fail(
				makeSplitToPagesError.dispatchFailed(
					describeLibrarianVamFailure(
						execution.failure,
						plan.value.vaultActions,
					),
					operationId,
					dispatchKind === "ExecutionUncertain"
						? "ExecutionUncertain"
						: "FailedBeforeExecution",
					execution.outcome.recovery,
				),
			);
		}
		if (execution.kind === "ReconciliationFailed") {
			return yield* Effect.fail(
				makeSplitToPagesError.reconciliationFailed({
					operationId,
					reason: `Reconciliation ${execution.outcome.id} ended ${execution.outcome.status}; recovery ${execution.outcome.recovery.kind}`,
					reconciliationId: execution.outcome.id,
					recovery: execution.outcome.recovery,
					status:
						execution.outcome.status === "PartialFailure"
							? "PartialFailure"
							: "Failed",
				}),
			);
		}

		return {
			execution,
			firstPagePath: plan.value.firstPagePath,
			pageCount: segmentation.pages.length,
			tooShort: false,
		};
	},
);

// ─── Public API ───

export const splitToPagesAction = Effect.fn("Librarian.splitToPagesAction")(
	function* (
		context: SplitToPagesContext,
		config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
	): Effect.fn.Return<SplitToPagesOutcome, SplitToPagesError> {
		const input = yield* gatherInput(context, config).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => handleSplitToPagesError(error)),
			),
		);

		const result = yield* executeIntention(context, input).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => handleSplitToPagesError(error)),
			),
		);
		if (result.tooShort) {
			// Should not happen because UI only exposes the action for multi-page content.
			return { kind: "TooShort" };
		}

		const { operationId } = result.execution;
		yield* context.vam.cd(result.firstPagePath).pipe(
			Effect.mapError((error) =>
				makeSplitToPagesError.navigationFailed(
					describeLibrarianVamFailure(error),
					operationId,
				),
			),
			Effect.tapError((error) =>
				Effect.sync(() => handleSplitToPagesError(error)),
			),
		);
		yield* Effect.sync(() => {
			new Notice(`Split into ${result.pageCount} pages`);
		});
		return {
			initialDispatch: result.execution.initialDispatch,
			kind: "Completed",
			navigation: { kind: "Completed", path: result.firstPagePath },
			operationId,
			reconciliation: result.execution.outcome,
		};
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
