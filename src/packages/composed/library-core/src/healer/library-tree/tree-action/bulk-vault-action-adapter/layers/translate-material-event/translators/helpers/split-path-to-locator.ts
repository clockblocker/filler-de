import type { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result as EffectResult } from "effect";
import { err, ok, type Result } from "neverthrow";
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
): Result<TreeNodeLocatorForLibraryScopedSplitPath<SK>, string> {
	const withSeparatedSuffixResult = EffectResult.mapError(
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		),
		(error) => error.message,
	);

	if (EffectResult.isFailure(withSeparatedSuffixResult)) {
		return err(withSeparatedSuffixResult.failure);
	}

	const { libraryRootName } = codecs.rules;
	const cspRes = canonizeSplitPathWithSeparatedSuffix(
		codecs.suffix,
		libraryRootName,
		withSeparatedSuffixResult.success,
	).mapErr((error) => error.message);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = EffectResult.mapError(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
		(error) => error.message,
	);
	if (EffectResult.isFailure(locatorRes)) return err(locatorRes.failure);

	// Cast is safe: locator type corresponds to split path kind
	return ok(
		locatorRes.success as unknown as TreeNodeLocatorForLibraryScopedSplitPath<SK>,
	);
}
