import { Result } from "effect";
import type {
	AnySplitPathInsideLibrary,
	Codecs,
} from "../../../../../../../../codecs";
import { canonizeSplitPathWithSeparatedSuffix } from "../../../../../utils/canonical-naming/canonicalization-policy";
import { tryCanonicalizeSplitPathToDestination } from "../../../../../utils/canonical-naming/canonicalize-to-destination";
import {
	type CanonicalSplitPathToDestination,
	MaterializedEventKind,
	type MaterializedNodeEvent,
	type TreeNodeLocatorForEvent,
} from "../../../materialized-node-events/types";
import { inferPolicyAndIntent } from "../../policy-and-intent/infer-policy-and-intent";

export function tryMakeDestinationLocatorFromEvent<
	E extends MaterializedNodeEvent,
>(ev: E, codecs: Codecs): Result.Result<TreeNodeLocatorForEvent<E>, string> {
	const cspRes = tryMakeCanonicalSplitPathToDestination(ev, codecs);
	if (Result.isFailure(cspRes)) return Result.fail(cspRes.failure);

	const locatorRes = Result.mapError(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.success),
		(error) => error.message,
	);
	if (Result.isFailure(locatorRes)) return Result.fail(locatorRes.failure);

	// Cast is safe: locator type corresponds to event's split path kind
	return Result.succeed(locatorRes.success as TreeNodeLocatorForEvent<E>);
}

const tryMakeCanonicalSplitPathToDestination = <
	E extends MaterializedNodeEvent,
>(
	ev: E,
	codecs: Codecs,
): Result.Result<CanonicalSplitPathToDestination<E>, string> => {
	if (ev.kind === MaterializedEventKind.Delete) {
		const withSeparatedSuffixResult = Result.mapError(
			codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
				ev.splitPath,
			),
			(error) => error.message,
		);
		if (Result.isFailure(withSeparatedSuffixResult)) {
			return Result.fail(withSeparatedSuffixResult.failure);
		}
		const { libraryRootName } = codecs.rules;
		const r = Result.mapError(
			canonizeSplitPathWithSeparatedSuffix(
				codecs.suffix,
				libraryRootName,
				withSeparatedSuffixResult.success,
			),
			(error) => error.message,
		);
		return r as Result.Result<CanonicalSplitPathToDestination<E>, string>;
	}

	const sp = extractSplitPathToDestination(ev);
	if (!("kind" in sp)) {
		return Result.fail("Invalid split path: missing kind");
	}
	const { policy, intent } = inferPolicyAndIntent(
		ev as MaterializedNodeEvent,
		codecs,
	);

	const r = tryCanonicalizeSplitPathToDestination(
		sp as AnySplitPathInsideLibrary,
		policy,
		intent,
		codecs,
	);
	return r as Result.Result<CanonicalSplitPathToDestination<E>, string>;
};

const extractSplitPathToDestination = (e: MaterializedNodeEvent) => {
	switch (e.kind) {
		case MaterializedEventKind.Rename:
			return e.to;
		case MaterializedEventKind.Create:
		case MaterializedEventKind.Delete:
			return e.splitPath;
	}
};
