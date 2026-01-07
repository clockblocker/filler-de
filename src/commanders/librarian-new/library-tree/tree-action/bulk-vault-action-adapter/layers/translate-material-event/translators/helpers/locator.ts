import { err, ok, type Result } from "neverthrow";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../../types/schemas/node-name";
import { tryParseCanonicalSplitPathInsideLibrary } from "../../../../../utils/canonical-naming/canonical-split-path-codec";
import {
	makePathPartsFromSuffixParts,
	tryMakeSeparatedSuffixedBasename,
} from "../../../../../utils/canonical-naming/suffix-utils/core-suffix-utils";
import type { CanonicalSplitPathInsideLibrary } from "../../../../../utils/canonical-naming/types";
import { makeLocatorFromCanonicalSplitPathInsideLibrary } from "../../../../../utils/locator/locator-codec";
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

	const locator = makeLocatorFromCanonicalSplitPathInsideLibrary(
		cspRes.value,
	);

	return ok(locator as TreeNodeLocatorForEvent<E>);
}

export function tryMakeTargetLocatorFromLibraryScopedSplitPath<
	SP extends SplitPathInsideLibrary,
>(sp: SP): Result<TreeNodeLocatorForLibraryScopedSplitPath<SP>, string> {
	const cspRes = tryParseCanonicalSplitPathInsideLibrary(sp);
	if (cspRes.isErr()) return err(cspRes.error);

	const locator = makeLocatorFromCanonicalSplitPathInsideLibrary(
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
		const r = tryParseCanonicalSplitPathInsideLibrary(ev.splitPath);
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
): Result<CanonicalSplitPathInsideLibrary, string> => {
	const effectivePolicy =
		intent === RenameIntent.Rename ? ChangePolicy.PathKing : policy;

	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	if (effectivePolicy === ChangePolicy.NameKing) {
		// MOVE-by-name: interpret basename as parent-child chain, not suffix chain
		// "sweet-pie" → firstSection="sweet", nodeName="pie"
		// "sweet-berry-pie" → firstSection="sweet", extraSections=["berry"], nodeName="pie"
		if (
			intent === RenameIntent.Move &&
			sepRes.value.suffixParts.length > 0
		) {
			// First segment becomes first parent section
			const firstSection = sepRes.value.coreName;
			const suffixParts = sepRes.value.suffixParts;

			// Last suffix part becomes node name
			const lastSuffixPart = suffixParts[suffixParts.length - 1];
			if (!lastSuffixPart) {
				return err("MOVE-by-name requires at least one suffix part");
			}
			// All suffix parts except last become additional parent sections
			const extraSections = suffixParts.slice(0, -1);

			// Parse existing pathParts as sectionNames (includes Library root if present)
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

			// Combine: existing pathParts (including Library) + first section + extra sections
			return ok({
				...sp,
				separatedSuffixedBasename: {
					coreName: lastSuffixPart,
					suffixParts: [
						...sectionNamesFromPath,
						firstSection,
						...extraSections,
					],
				},
			});
		}

		// Regular NameKing (Create): suffix chain interpretation
		const sectionNames = makePathPartsFromSuffixParts(
			sepRes.value,
		) as NodeName[];

		return ok({
			...sp,
			sectionNames,
			separatedSuffixedBasename: {
				coreName: sepRes.value.coreName,
				suffixParts: sectionNames,
			},
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
		separatedSuffixedBasename: {
			coreName: sepRes.value.coreName,
			suffixParts: sectionNames,
		},
	});
};
