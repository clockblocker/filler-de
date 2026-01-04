import { err, ok, type Result } from "neverthrow";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../../types/schemas/node-name";
import { tryParseCanonicalSplitPath } from "../../../../../utils/canonical-split-path-utils/try-parse-canonical-split-path";
import type { CanonicalSplitPath } from "../../../../../utils/canonical-split-path-utils/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../../../../../utils/make-locator";
import {
	makePathPartsFromSuffixParts,
	tryMakeSeparatedSuffixedBasename,
} from "../../../../../utils/suffix-utils/suffix-utils";
import type { SplitPathInsideLibrary } from "../../../library-scope/types/inside-library-split-paths";
import {
	type CanonicalSplitPathToDestination,
	MaterializedEventType,
	type MaterializedNodeEvent,
	type TreeNodeLocatorForEvent,
	type TreeNodeLocatorForLibraryScopedSplitPath,
} from "../../../materialized-node-events/types";
import {
	ChangePolicy,
	inferPolicyAndIntent,
	RenameIntent,
} from "../../policy-and-intent";

export function tryMakeDestinationLocatorFromEvent<
	E extends MaterializedNodeEvent,
>(ev: E): Result<TreeNodeLocatorForEvent<E>, string> {
	const cspRes = tryMakeCanonicalSplitPathToDestination(ev);
	if (cspRes.isErr()) return err(cspRes.error);

	const locator = makeLocatorFromLibraryScopedCanonicalSplitPath(
		cspRes.value,
	);

	return ok(locator as TreeNodeLocatorForEvent<E>);
}

export function tryMakeTargetLocatorFromLibraryScopedSplitPath<
	SP extends SplitPathInsideLibrary,
>(sp: SP): Result<TreeNodeLocatorForLibraryScopedSplitPath<SP>, string> {
	const cspRes = tryParseCanonicalSplitPath(sp);
	if (cspRes.isErr()) return err(cspRes.error);

	const locator = makeLocatorFromLibraryScopedCanonicalSplitPath(
		cspRes.value,
	);

	return ok(locator as TreeNodeLocatorForLibraryScopedSplitPath<SP>);
}

const tryMakeCanonicalSplitPathToDestination = <
	E extends MaterializedNodeEvent,
>(
	ev: E,
): Result<CanonicalSplitPathToDestination<E>, string> => {
	if (ev.kind === MaterializedEventType.Delete) {
		const r = tryParseCanonicalSplitPath(ev.splitPath);
		return r as Result<CanonicalSplitPathToDestination<E>, string>;
	}

	const sp = extractSplitPathToDestination(ev) as SplitPathInsideLibrary;
	const { policy, intent } = inferPolicyAndIntent(
		ev as MaterializedNodeEvent,
	);

	const r = tryCanonicalizeSplitPathToDestination(sp, policy, intent);
	return r as Result<CanonicalSplitPathToDestination<E>, string>;
};

const extractSplitPathToDestination = (e: MaterializedNodeEvent) => {
	switch (e.kind) {
		case MaterializedEventType.Rename:
			return e.to;
		case MaterializedEventType.Create:
		case MaterializedEventType.Delete:
			return e.splitPath;
	}
};

export const tryCanonicalizeSplitPathToDestination = (
	sp: SplitPathInsideLibrary,
	policy: ChangePolicy,
	intent?: RenameIntent, // undefined = not rename
): Result<CanonicalSplitPath, string> => {
	const effectivePolicy =
		intent === RenameIntent.Rename ? ChangePolicy.PathKing : policy;

	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	if (effectivePolicy === ChangePolicy.NameKing) {
		// MOVE-by-name: interpret basename as parent-child, not suffix chain
		// "sweet-pie" → parent="sweet", child="pie"
		if (
			intent === RenameIntent.Move &&
			sepRes.value.suffixParts.length > 0
		) {
			// First segment becomes parent, first suffix part becomes node name
			const parentName = sepRes.value.nodeName;
			const childName = sepRes.value.suffixParts[0];
			if (!childName) {
				return err("MOVE-by-name requires at least one suffix part");
			}

			// Parse existing pathParts as sectionNames
			const sectionNamesFromPath: NodeName[] = [];
			for (const seg of sp.pathParts) {
				const r = NodeNameSchema.safeParse(seg);
				if (!r.success)
					return err(
						r.error.issues[0]?.message ??
							"Invalid section NodeName",
					);
				sectionNamesFromPath.push(r.data);
			}

			// Parent becomes new section, child becomes node name
			return ok({
				...sp,
				nodeName: childName,
				sectionNames: [...sectionNamesFromPath, parentName],
			});
		}

		// Regular NameKing (Create): suffix chain interpretation
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
