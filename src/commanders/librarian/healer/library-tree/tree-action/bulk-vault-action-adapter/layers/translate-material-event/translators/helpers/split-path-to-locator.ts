import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../../../global-state/global-state";
import type { SplitPathKind } from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Codecs,
	SplitPathInsideLibraryOf,
} from "../../../../../../../../codecs";
import { canonizeSplitPathWithSeparatedSuffix } from "../../../../../utils/canonical-naming/canonicalization-policy";
import type { TreeNodeLocatorForLibraryScopedSplitPath } from "../../../materialized-node-events/types";
import { adaptCodecResult } from "../../error-adapters";

export function tryMakeTargetLocatorFromLibraryScopedSplitPath<
	SK extends SplitPathKind,
>(
	sp: SplitPathInsideLibraryOf<SK>,
	codecs: Codecs,
): Result<TreeNodeLocatorForLibraryScopedSplitPath<SK>, string> {
	const withSeparatedSuffixResult = adaptCodecResult(
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		),
	);

	if (withSeparatedSuffixResult.isErr()) {
		return err(withSeparatedSuffixResult.error);
	}

	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const libraryRootName = splitPathToLibraryRoot.basename;
	const cspRes = adaptCodecResult(
		canonizeSplitPathWithSeparatedSuffix(
			codecs.suffix,
			libraryRootName,
			withSeparatedSuffixResult.value,
		),
	);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = adaptCodecResult(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
	);
	if (locatorRes.isErr()) return err(locatorRes.error);

	// Cast is safe: locator type corresponds to split path kind
	return ok(
		locatorRes.value as unknown as TreeNodeLocatorForLibraryScopedSplitPath<SK>,
	);
}
