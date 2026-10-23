import { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type {
	Codecs,
	FileNodeLocator,
	ScrollNodeLocator,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../codecs";
import { TreeActionError } from "../../healer/library-tree/tree-action/tree-action-error";
import type { HealingAction } from "../../healer/library-tree/types/healing-action";
import { buildCanonicalLeafSplitPath } from "../../tree/utils";
import { splitPathsEqual } from "../split-path-equality";

/**
 * Compute healing actions for a leaf node (Scroll or File).
 * Compares observed path against canonical path and generates rename if needed.
 * Fails when the locator has no canonical split path.
 */
export function computeLeafHealingForScroll(
	locator: ScrollNodeLocator,
	observedSplitPath: SplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): Result.Result<HealingAction[], TreeActionError> {
	const canonicalSplitPathResult = buildCanonicalLeafSplitPath(
		locator,
		codecs,
	);
	if (Result.isFailure(canonicalSplitPathResult)) {
		return Result.fail(
			new TreeActionError({
				message: `Failed to build canonical split path: ${canonicalSplitPathResult.failure.message}`,
			}),
		);
	}
	const canonicalSplitPath = canonicalSplitPathResult.success;
	const healingActions: HealingAction[] = [];

	if (!splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
		if (canonicalSplitPath.kind === SplitPathKind.MdFile) {
			healingActions.push({
				kind: "RenameMdFile",
				payload: {
					from: observedSplitPath,
					to: canonicalSplitPath,
				},
			});
		}
	}

	return Result.succeed(healingActions);
}

export function computeLeafHealingForFile(
	locator: FileNodeLocator,
	observedSplitPath: SplitPathToFileInsideLibrary,
	codecs: Codecs,
): Result.Result<HealingAction[], TreeActionError> {
	const canonicalSplitPathResult = buildCanonicalLeafSplitPath(
		locator,
		codecs,
	);
	if (Result.isFailure(canonicalSplitPathResult)) {
		return Result.fail(
			new TreeActionError({
				message: `Failed to build canonical split path: ${canonicalSplitPathResult.failure.message}`,
			}),
		);
	}
	const canonicalSplitPath = canonicalSplitPathResult.success;
	const healingActions: HealingAction[] = [];

	if (!splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
		if (canonicalSplitPath.kind === SplitPathKind.File) {
			healingActions.push({
				kind: "RenameFile",
				payload: {
					from: observedSplitPath,
					to: canonicalSplitPath,
				},
			});
		}
	}

	return Result.succeed(healingActions);
}
