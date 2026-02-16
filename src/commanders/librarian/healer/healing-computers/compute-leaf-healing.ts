import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../codecs";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../../codecs/locator/types";
import type { HealingAction } from "../library-tree/types/healing-action";
import { buildCanonicalLeafSplitPath } from "../library-tree/utils/split-path-utils";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";

/**
 * Compute healing actions for a leaf node (Scroll or File).
 * Compares observed path against canonical path and generates rename if needed.
 */
export function computeLeafHealingForScroll(
	locator: ScrollNodeLocator,
	observedSplitPath: SplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): HealingAction[] {
	const canonicalSplitPathResult = buildCanonicalLeafSplitPath(
		locator,
		codecs,
	);
	if (canonicalSplitPathResult.isErr()) {
		throw new Error(
			`Failed to build canonical split path: ${canonicalSplitPathResult.error.message}`,
		);
	}
	const canonicalSplitPath = canonicalSplitPathResult.value;
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

	return healingActions;
}

export function computeLeafHealingForFile(
	locator: FileNodeLocator,
	observedSplitPath: SplitPathToFileInsideLibrary,
	codecs: Codecs,
): HealingAction[] {
	const canonicalSplitPathResult = buildCanonicalLeafSplitPath(
		locator,
		codecs,
	);
	if (canonicalSplitPathResult.isErr()) {
		throw new Error(
			`Failed to build canonical split path: ${canonicalSplitPathResult.error.message}`,
		);
	}
	const canonicalSplitPath = canonicalSplitPathResult.value;
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

	return healingActions;
}
