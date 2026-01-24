import type { CheckboxFrontmatterPayload } from "../../../../managers/obsidian/user-event-interceptor";
import { logger } from "../../../../utils/logger";
import type { CodecRules, Codecs } from "../../codecs";
import type { ScrollNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import { isCodexSplitPath } from "../../healer/library-tree/codex/helpers";
import { tryParseAsInsideLibrarySplitPath } from "../../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { tryMakeTargetLocatorFromLibraryScopedSplitPath } from "../../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/split-path-to-locator";
import type { TreeAction } from "../../healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../healer/library-tree/tree-node/types/atoms";

/**
 * Result of handling a checkbox click.
 */
export type CheckboxHandlerResult = {
	action: TreeAction;
} | null;

/**
 * Handle property checkbox click (frontmatter status toggle).
 * Returns a TreeAction to enqueue, or null if no action needed.
 */
export function handlePropertyCheckboxClick(
	payload: CheckboxFrontmatterPayload,
	codecs: Codecs,
	rules: CodecRules,
): CheckboxHandlerResult {
	// Only handle "status" property
	if (payload.propertyName !== "status") return null;

	// Skip codex files
	if (isCodexSplitPath(payload.splitPath)) return null;

	// Try to parse as library-scoped path
	const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
		payload.splitPath,
		rules,
	);
	if (libraryScopedResult.isErr()) return null;

	// Get locator from split path
	const locatorResult = tryMakeTargetLocatorFromLibraryScopedSplitPath(
		libraryScopedResult.value,
		codecs,
	);
	if (locatorResult.isErr()) {
		logger.warn(
			"[Librarian] Failed to get locator for property click:",
			locatorResult.error,
		);
		return null;
	}

	const locator = locatorResult.value;

	// Only handle scroll nodes
	if (locator.targetKind !== TreeNodeKind.Scroll) return null;

	const newStatus = payload.checked
		? TreeNodeStatus.Done
		: TreeNodeStatus.NotStarted;

	const action: TreeAction = {
		actionType: "ChangeStatus",
		newStatus,
		targetLocator: {
			segmentId: locator.segmentId as ScrollNodeSegmentId,
			segmentIdChainToParent: locator.segmentIdChainToParent,
			targetKind: TreeNodeKind.Scroll,
		},
	};

	return { action };
}
