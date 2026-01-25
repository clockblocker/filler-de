/**
 * Handler for task checkbox clicks inside codex files.
 * Parses the clicked line to identify the target scroll/section and updates its status.
 */

import type { CodecRules, Codecs } from "../../../commanders/librarian/codecs";
import {
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
} from "../../../commanders/librarian/codecs/segment-id/types/segment-id";
import { isCodexSplitPath } from "../../../commanders/librarian/healer/library-tree/codex/helpers";
import { parseCodexClickLineContent } from "../../../commanders/librarian/healer/library-tree/codex/parse-codex-click";
import { tryParseAsInsideLibrarySplitPath } from "../../../commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { TreeAction } from "../../../commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../commanders/librarian/healer/library-tree/tree-node/types/atoms";
import { logger } from "../../../utils/logger";
import {
	type CheckboxPayload,
	type EventHandler,
	HandlerOutcome,
} from "../../obsidian/user-event-interceptor";
import type { EnqueueFn } from "./checkbox-behavior";

/**
 * Create a handler for task checkbox clicks in codex files.
 * Parses the line content to identify the scroll/section and updates its status.
 *
 * @param _codecs - Codec instances (unused, kept for API consistency)
 * @param rules - Codec rules for path parsing
 * @param enqueue - Function to enqueue tree actions
 */
export function createCodexCheckboxHandler(
	_codecs: Codecs,
	rules: CodecRules,
	enqueue: EnqueueFn,
): EventHandler<CheckboxPayload> {
	return {
		doesApply: (payload) => {
			// Only handle codex files
			if (!isCodexSplitPath(payload.splitPath)) return false;

			// Must be inside the library
			const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
				payload.splitPath,
				rules,
			);
			return libraryScopedResult.isOk();
		},
		handle: (payload) => {
			// Parse line content to get target
			const parseResult = parseCodexClickLineContent(payload.lineContent);
			if (parseResult.isErr()) {
				logger.warn(
					"[CodexCheckboxHandler] Failed to parse line content:",
					parseResult.error,
				);
				return { outcome: HandlerOutcome.Passthrough };
			}

			const target = parseResult.value;
			const newStatus = payload.checked
				? TreeNodeStatus.Done
				: TreeNodeStatus.NotStarted;

			let action: TreeAction;

			if (target.kind === "Scroll") {
				// Build scroll segment ID from node name
				const scrollSegmentId =
					`${target.nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md` as ScrollNodeSegmentId;

				action = {
					actionType: "ChangeStatus",
					newStatus,
					targetLocator: {
						segmentId: scrollSegmentId,
						segmentIdChainToParent: target.parentChain,
						targetKind: TreeNodeKind.Scroll,
					},
				};
			} else {
				// Section: propagate status to all descendants
				const sectionChain = target.sectionChain;
				const segmentId = sectionChain[sectionChain.length - 1];
				const parentChain = sectionChain.slice(0, -1);

				action = {
					actionType: "ChangeStatus",
					newStatus,
					targetLocator: {
						segmentId,
						segmentIdChainToParent: parentChain,
						targetKind: TreeNodeKind.Section,
					},
				};
			}

			// Enqueue the action (fire and forget)
			enqueue(action);

			return { outcome: HandlerOutcome.Handled };
		},
	};
}
