import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../../global-state/global-state";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../../types/schemas/node-name";
import { tryParseCanonicalSplitPathInsideLibrary } from "../../../../../utils/canonical-naming/canonical-split-path-codec";
import { tryBuildCanonicalSeparatedSuffixedBasename } from "../../../../../utils/canonical-naming/suffix-utils/build-canonical-separated-suffixed-basename-path-king-way";
import {
	makeJoinedSuffixedBasename,
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

	// Always start by parsing the basename into (coreName, suffixFromName)
	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	// --- PathKing: pathParts are source of truth, build canonical from them
	if (effectivePolicy === ChangePolicy.PathKing) {
		// Validate pathParts first
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRootName = splitPathToLibraryRoot.basename;

		// Empty pathParts is allowed only for Library root folder
		if (sp.pathParts.length > 0) {
			// Non-empty pathParts must start with Library
			if (sp.pathParts[0] !== libraryRootName) {
				return err("ExpectedLibraryRoot");
			}

			// Validate all pathParts are valid NodeNames
			for (const p of sp.pathParts) {
				const r = NodeNameSchema.safeParse(p);
				if (!r.success) {
					return err(
						r.error.issues[0]?.message ?? "Invalid path part",
					);
				}
			}
		}

		// For PathKing, pathParts define the canonical structure
		// Extract coreName from basename, build suffixParts from pathParts
		return tryBuildCanonicalSeparatedSuffixedBasename(sp).map((canon) => {
			return {
				...sp,
				basename: makeJoinedSuffixedBasename(
					canon.separatedSuffixedBasename,
				),
				separatedSuffixedBasename: canon.separatedSuffixedBasename,
			};
		});
	}

	// --- NameKing: interpret basename as path intent, then OUTPUT PathKing-canonical split path

	// Helper: finalize by rebuilding canonical separated+basename using your central logic
	const finalize = (
		next: SplitPathInsideLibrary,
	): Result<CanonicalSplitPathInsideLibrary, string> => {
		return tryBuildCanonicalSeparatedSuffixedBasename(next).map((canon) => {
			const separatedSuffixedBasename = canon.separatedSuffixedBasename;

			return {
				...next,
				// force canonical basename
				basename: makeJoinedSuffixedBasename(separatedSuffixedBasename),
				separatedSuffixedBasename,
			};
		});
	};

	// MOVE-by-name:
	// basename "sweet-berry-pie" => firstSection="sweet", extraSections=["berry"], nodeName="pie"
	if (intent === RenameIntent.Move && sepRes.value.suffixParts.length > 0) {
		const firstSection = sepRes.value.coreName;
		const suffixPartsFromName = sepRes.value.suffixParts;

		const lastSuffixPart =
			suffixPartsFromName[suffixPartsFromName.length - 1];
		if (!lastSuffixPart)
			return err("MOVE-by-name requires at least one suffix part");

		const extraSections = suffixPartsFromName.slice(0, -1);

		// destination parent chain = existing pathParts + firstSection + extraSections
		const nextPathParts = [...sp.pathParts, firstSection, ...extraSections];

		// destination node name = lastSuffixPart, so basename core should be that
		// (we feed it in as basename so splitBySuffixDelimiter yields coreName=lastSuffixPart)
		return finalize({
			...sp,
			basename: lastSuffixPart,
			pathParts: nextPathParts,
		});
	}

	// Regular NameKing (Create / non-move):
	// interpret basename suffix chain as parent chain
	// coreName stays nodeName; suffixParts become extra parent sections (your helper decides exact mapping)
	const convertedPathParts = makePathPartsFromSuffixParts(
		sepRes.value,
	) as NodeName[];

	// Preserve Library root from original pathParts
	const libraryRoot = sp.pathParts[0];
	const nextPathParts = libraryRoot
		? [libraryRoot, ...convertedPathParts]
		: convertedPathParts;

	return finalize({
		...sp,
		basename: sepRes.value.coreName,
		pathParts: nextPathParts,
	});
};
