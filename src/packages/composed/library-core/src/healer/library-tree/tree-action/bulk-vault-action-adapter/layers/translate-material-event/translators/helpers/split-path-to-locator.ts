import type { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type {
	Codecs,
	SplitPathInsideLibraryOf,
} from "../../../../../../../../codecs";
import { canonizeSplitPathWithSeparatedSuffix } from "../../../../../utils/canonical-naming/canonicalization-policy";
import type { TreeNodeLocatorForLibraryScopedSplitPath } from "../../../materialized-node-events/types";

export function tryMakeTargetLocatorFromLibraryScopedSplitPath<
	SK extends SplitPathKind,
>(
	sp: SplitPathInsideLibraryOf<SK>,
	codecs: Codecs,
): Result.Result<TreeNodeLocatorForLibraryScopedSplitPath<SK>, string> {
	const withSeparatedSuffixResult = Result.mapError(
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		),
		(error) => error.message,
	);

	if (Result.isFailure(withSeparatedSuffixResult)) {
		return Result.fail(withSeparatedSuffixResult.failure);
	}

	const { libraryRootName } = codecs.rules;
	const cspRes = Result.mapError(
		canonizeSplitPathWithSeparatedSuffix(
			codecs.suffix,
			libraryRootName,
			withSeparatedSuffixResult.success,
		),
		(error) => error.message,
	);
	if (Result.isFailure(cspRes)) return Result.fail(cspRes.failure);

	const locatorRes = Result.mapError(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.success),
		(error) => error.message,
	);
	if (Result.isFailure(locatorRes)) return Result.fail(locatorRes.failure);

	// Cast is safe: locator type corresponds to split path kind
	return Result.succeed(
		locatorRes.success as unknown as TreeNodeLocatorForLibraryScopedSplitPath<SK>,
	);
}
