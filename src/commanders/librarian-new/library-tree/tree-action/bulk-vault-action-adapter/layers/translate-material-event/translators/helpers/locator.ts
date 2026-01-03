import { err, ok, type Result } from "neverthrow";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../../types/schemas/node-name";
import type { CanonicalSplitPath } from "../../../../../utils/canonical-split-path-utils/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../../../../../utils/make-locator";
import {
	makePathPartsFromSuffixParts,
	tryMakeSeparatedSuffixedBasename,
} from "../../../../../utils/suffix-utils/suffix-utils";
import type { SplitPathInsideLibrary } from "../../../library-scope/types/inside-library-split-paths";
import {
	type CanonicalSplitPathToTarget,
	MaterializedEventType,
	type MaterializedNodeEvent,
	type TargetTreeNodeLocator,
} from "../../../materialized-node-events/types";
import {
	ChangePolicy,
	inferPolicyAndIntent,
	RenameIntent,
} from "../../policy-and-intent";

export function tryMakeTargetLocator<E extends MaterializedNodeEvent>(
	ev: E,
): Result<TargetTreeNodeLocator<E>, string> {
	const cspRes = tryMakeCanonicalSplitPathToTarget(ev);
	if (cspRes.isErr()) return err(cspRes.error);

	const locator = makeLocatorFromLibraryScopedCanonicalSplitPath(
		cspRes.value,
	);

	return ok(locator as TargetTreeNodeLocator<E>);
}

const tryMakeCanonicalSplitPathToTarget = <E extends MaterializedNodeEvent>(
	ev: E,
): Result<CanonicalSplitPathToTarget<E>, string> => {
	const sp = extractSplitPathToTarget(ev) as SplitPathInsideLibrary;
	const { policy, intent } = inferPolicyAndIntent(
		ev as MaterializedNodeEvent,
	);

	const r = tryCanonicalizeSplitPathToTarget(sp, policy, intent);
	return r as Result<CanonicalSplitPathToTarget<E>, string>;
};

const extractSplitPathToTarget = (e: MaterializedNodeEvent) => {
	switch (e.kind) {
		case MaterializedEventType.Rename:
			return e.to;
		case MaterializedEventType.Create:
		case MaterializedEventType.Delete:
			return e.splitPath;
	}
};

const tryCanonicalizeSplitPathToTarget = (
	sp: SplitPathInsideLibrary,
	policy: ChangePolicy,
	intent?: RenameIntent, // undefined = not rename
): Result<CanonicalSplitPath, string> => {
	const effectivePolicy =
		intent === RenameIntent.Rename ? ChangePolicy.PathKing : policy;

	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	if (effectivePolicy === ChangePolicy.NameKing) {
		const sectionNames = makePathPartsFromSuffixParts(
			sepRes.value,
		) as NodeName[];

		return ok({
			...sp,
			nodeName: sepRes.value.nodeName,
			sectionNames,
		});
	}

	// PathKing
	const sectionNames: NodeName[] = [];
	for (const seg of sp.pathParts) {
		const r = NodeNameSchema.safeParse(seg);
		if (!r.success)
			return err(
				r.error.issues[0]?.message ?? "Invalid section NodeName",
			);
		sectionNames.push(r.data);
	}

	return ok({
		...sp,
		nodeName: sepRes.value.nodeName,
		sectionNames,
	});
};
