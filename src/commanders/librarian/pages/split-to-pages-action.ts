/**
 * Split to Pages command handler.
 * Splits a long markdown file into paginated folder structure.
 */

import {
	type CodecRules,
	parseSeparatedSuffix,
} from "@textfresser/library-core";
import { goBackLinkHelper } from "@textfresser/note-addressing";
import type {
	SplitPathToMdFile,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
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
	vam: Pick<VaultActionManager, "cd" | "getActiveEditorContext">;
	/** Tells the user how the split went. */
	notify: (message: string) => void;
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
	const editorContext = yield* context.vam
		.getActiveEditorContext()
		.pipe(
			Effect.mapError((error) =>
				makeSplitToPagesError.noPwd(error.message),
			),
		);
	if (!editorContext) {
		return yield* Effect.fail(
			makeSplitToPagesError.noPwd("Active file is not a markdown file"),
		);
	}
	const { content, splitPath: sourcePath } = editorContext;

	// The Librarian's own rules: it heals the pages under them.
	const rules = context.librarian.codecRules;
	if (!rules) {
		return yield* makeSplitToPagesError.librarianUnavailable(
			"the Librarian has not started",
		);
	}

	const basenameResult = parseSeparatedSuffix(rules, sourcePath.basename);
	if (Result.isFailure(basenameResult)) {
		return yield* Effect.fail(
			makeSplitToPagesError.parseFailed(basenameResult.failure.message),
		);
	}

	// Strip go-back links before segmentation
	const cleanContent = goBackLinkHelper.strip(content);
	const segmentation = segmentContentWithBlockMarkers(
		cleanContent,
		basenameResult.success,
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
		if (Result.isFailure(plan)) {
			return yield* Effect.fail(
				makeSplitToPagesError.intentionFailed(
					`Source path is outside the configured Library: ${plan.failure.path.pathParts.join("/")}/${plan.failure.path.basename}`,
				),
			);
		}

		const execution = yield* context.librarian
			.executeSplitIntention(plan.success)
			.pipe(
				Effect.mapError(() =>
					makeSplitToPagesError.librarianUnavailable(
						"the Librarian is not running",
					),
				),
			);
		const { operationId } = execution;

		if (execution.kind === "VaultDispatchFailed") {
			const dispatchKind = execution.outcome.dispatch.kind;
			return yield* Effect.fail(
				makeSplitToPagesError.dispatchFailed(
					execution.failure.message,
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
			firstPagePath: plan.success.firstPagePath,
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
		const reportError = handleSplitToPagesError(context.notify);
		const input = yield* gatherInput(context, config).pipe(
			Effect.tapError(reportError),
		);

		const result = yield* executeIntention(context, input).pipe(
			Effect.tapError(reportError),
		);
		if (result.tooShort) {
			// Should not happen because UI only exposes the action for multi-page content.
			return { kind: "TooShort" };
		}

		const { operationId } = result.execution;
		yield* context.vam.cd(result.firstPagePath).pipe(
			Effect.mapError((error) =>
				makeSplitToPagesError.navigationFailed(
					error.message,
					operationId,
				),
			),
			Effect.tapError(reportError),
		);
		yield* Effect.sync(() =>
			context.notify(`Split into ${result.pageCount} pages`),
		);
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
	if (Result.isFailure(basenameResult)) return false;

	const cleanContent = goBackLinkHelper.strip(content);
	const result = segmentContent(cleanContent, basenameResult.success, config);
	return result.pages.length > 1;
}
