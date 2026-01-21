import { getParsedUserSettings } from "../../../global-state/global-state";
import { FileType } from "../../../types/common-interface/enums";
import { BACK_ARROW, FORWARD_ARROW } from "../../../types/literals";
import {
	ActionKind,
	ActionPlacement,
	type CommanderAction,
	type CommanderActionProvider,
	type OverlayContext,
} from "./types";

/**
 * Action provider for Librarian-related actions.
 * Translates the existing action availability logic into CommanderActionProvider interface.
 *
 * Priority 1 = highest, processed first among all commanders.
 */
export class LibrarianActionProvider implements CommanderActionProvider {
	readonly id = "librarian";
	readonly priority = 1;

	getAvailableActions(ctx: OverlayContext): CommanderAction[] {
		const actions: CommanderAction[] = [];

		// ─── Bottom Actions ───

		// PreviousPage: show on Page files, disabled if first page
		if (
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null
		) {
			actions.push({
				disabled: ctx.pageIndex <= 0,
				id: "PreviousPage",
				kind: ActionKind.NavigatePage,
				label: BACK_ARROW,
				params: { direction: "prev" },
				placement: ActionPlacement.Bottom,
				priority: 1,
			});
		}

		// NavigatePage (Next): show on Page files, disabled if no next page
		if (
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null
		) {
			actions.push({
				disabled: !ctx.hasNextPage,
				id: "NavigatePage",
				kind: ActionKind.NavigatePage,
				label: FORWARD_ARROW,
				params: { direction: "next" },
				placement: ActionPlacement.Bottom,
				priority: 2,
			});
		}

		// SplitToPages: show on Scroll files when no selection
		if (
			ctx.isInLibrary &&
			ctx.fileType === FileType.Scroll &&
			!ctx.hasSelection
		) {
			actions.push({
				id: "SplitToPages",
				kind: ActionKind.SplitToPages,
				label: "Split to Pages",
				params: {},
				placement: ActionPlacement.Bottom,
				priority: 1,
			});
		}

		// MakeText: show on files without type, or Scroll files that would split to multiple pages
		if (
			ctx.isInLibrary &&
			(ctx.fileType === null ||
				(ctx.fileType === FileType.Scroll &&
					ctx.wouldSplitToMultiplePages))
		) {
			actions.push({
				id: "MakeText",
				kind: ActionKind.MakeText,
				label: "Make this a text",
				params: {},
				placement: ActionPlacement.Bottom,
				priority: 2,
			});
		}

		// Generate: show when selection exists in library
		if (ctx.hasSelection && ctx.isInLibrary) {
			actions.push({
				id: "Generate",
				kind: ActionKind.Generate,
				label: "Generate",
				params: {},
				placement: ActionPlacement.Bottom,
				priority: 5,
			});
		}

		// ─── Selection Actions ───
		// Placement controlled by per-action settings

		const {
			translatePlacement,
			splitInBlocksPlacement,
			explainGrammarPlacement,
		} = getParsedUserSettings();

		// TranslateSelection: show when selection exists
		if (ctx.hasSelection && translatePlacement !== "shortcut-only") {
			actions.push({
				id: "TranslateSelection",
				kind: ActionKind.TranslateSelection,
				label: "Translate",
				params: {},
				placement:
					translatePlacement === "bottom"
						? ActionPlacement.Bottom
						: ActionPlacement.Selection,
				priority: 1,
			});
		}

		// SplitInBlocks: show when selection exists in library
		if (
			ctx.hasSelection &&
			ctx.isInLibrary &&
			splitInBlocksPlacement !== "shortcut-only"
		) {
			actions.push({
				id: "SplitInBlocks",
				kind: ActionKind.SplitInBlocks,
				label: "Split in Blocks",
				params: {},
				placement:
					splitInBlocksPlacement === "bottom"
						? ActionPlacement.Bottom
						: ActionPlacement.Selection,
				priority: 2,
			});
		}

		// ExplainGrammar: show when selection exists in library
		if (
			ctx.hasSelection &&
			ctx.isInLibrary &&
			explainGrammarPlacement !== "shortcut-only"
		) {
			actions.push({
				id: "ExplainGrammar",
				kind: ActionKind.ExplainGrammar,
				label: "Explain Grammar",
				params: {},
				placement:
					explainGrammarPlacement === "bottom"
						? ActionPlacement.Bottom
						: ActionPlacement.Selection,
				priority: 3,
			});
		}

		return actions;
	}
}
