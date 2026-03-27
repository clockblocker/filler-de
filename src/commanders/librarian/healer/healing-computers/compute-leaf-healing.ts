import { SplitPathKind } from "@textfresser/vault-action-manager/types/split-path";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";
import type {
	Codecs,
	FileNodeLocator,
	ScrollNodeLocator,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "@textfresser/library-core/codecs";
import type { HealingAction } from "@textfresser/library-core/healing";
import { buildCanonicalLeafSplitPath } from "@textfresser/library-core/healer/library-tree/utils/split-path-utils";

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
