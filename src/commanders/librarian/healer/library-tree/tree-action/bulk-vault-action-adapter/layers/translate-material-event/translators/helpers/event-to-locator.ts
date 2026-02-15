import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../../../global-state/global-state";
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
import { adaptCodecResult } from "../../error-adapters";
import { inferPolicyAndIntent } from "../../policy-and-intent/infer-policy-and-intent";

export function tryMakeDestinationLocatorFromEvent<
	E extends MaterializedNodeEvent,
>(ev: E, codecs: Codecs): Result<TreeNodeLocatorForEvent<E>, string> {
	const cspRes = tryMakeCanonicalSplitPathToDestination(ev, codecs);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = adaptCodecResult(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
	);
	if (locatorRes.isErr()) return err(locatorRes.error);

	// Cast is safe: locator type corresponds to event's split path kind
	return ok(locatorRes.value as TreeNodeLocatorForEvent<E>);
}

const tryMakeCanonicalSplitPathToDestination = <
	E extends MaterializedNodeEvent,
>(
	ev: E,
	codecs: Codecs,
): Result<CanonicalSplitPathToDestination<E>, string> => {
	if (ev.kind === MaterializedEventKind.Delete) {
		const withSeparatedSuffixResult = adaptCodecResult(
			codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
				ev.splitPath,
			),
		);
		if (withSeparatedSuffixResult.isErr()) {
			return err(withSeparatedSuffixResult.error) as Result<
				CanonicalSplitPathToDestination<E>,
				string
			>;
		}
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRootName = splitPathToLibraryRoot.basename;
		const r = adaptCodecResult(
			canonizeSplitPathWithSeparatedSuffix(
				codecs.suffix,
				libraryRootName,
				withSeparatedSuffixResult.value,
			),
		);
		return r as Result<CanonicalSplitPathToDestination<E>, string>;
	}

	const sp = extractSplitPathToDestination(ev);
	if (!("kind" in sp)) {
		return err("Invalid split path: missing kind");
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
	return r as Result<CanonicalSplitPathToDestination<E>, string>;
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
