import { err, ok, type Result } from "neverthrow";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../../../../../../types/schemas/node-name";
import type { Codecs } from "../../../../../../codecs";
import type { CanonicalSplitPathInsideLibrary } from "../../../../../utils/canonical-naming/types";
import type { SplitPathInsideLibrary } from "../../../library-scope/types/inside-library-split-paths";
import {
	type CanonicalSplitPathToDestination,
	MaterializedEventKind,
	type MaterializedNodeEvent,
	type TreeNodeLocatorForEvent,
	type TreeNodeLocatorForLibraryScopedSplitPath,
} from "../../../materialized-node-events/types";
import { adaptCodecResult } from "../../error-adapters";
import {
	ChangePolicy,
	inferPolicyAndIntent,
	RenameIntent,
} from "../../policy-and-intent";

export function tryMakeDestinationLocatorFromEvent<
	E extends MaterializedNodeEvent,
>(ev: E, codecs: Codecs): Result<TreeNodeLocatorForEvent<E>, string> {
	const cspRes = tryMakeCanonicalSplitPathToDestination(ev, codecs);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = adaptCodecResult(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
	);
	if (locatorRes.isErr()) return err(locatorRes.error);

	return ok(locatorRes.value as TreeNodeLocatorForEvent<E>);
}

export function tryMakeTargetLocatorFromLibraryScopedSplitPath<
	SP extends SplitPathInsideLibrary,
>(
	sp: SP,
	codecs: Codecs,
): Result<TreeNodeLocatorForLibraryScopedSplitPath<SP>, string> {
	const cspRes = adaptCodecResult(
		codecs.canonicalSplitPath.splitPathInsideLibraryToCanonical(sp),
	);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = adaptCodecResult(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
	);
	if (locatorRes.isErr()) return err(locatorRes.error);

	return ok(locatorRes.value as TreeNodeLocatorForLibraryScopedSplitPath<SP>);
}

const tryMakeCanonicalSplitPathToDestination = <
	E extends MaterializedNodeEvent,
>(
	ev: E,
	codecs: Codecs,
): Result<CanonicalSplitPathToDestination<E>, string> => {
	if (ev.kind === MaterializedEventKind.Delete) {
		const r = adaptCodecResult(
			codecs.canonicalSplitPath.splitPathInsideLibraryToCanonical(
				ev.splitPath,
			),
		);
		return r as Result<CanonicalSplitPathToDestination<E>, string>;
	}

	const sp = extractSplitPathToDestination(ev) as SplitPathInsideLibrary;
	const { policy, intent } = inferPolicyAndIntent(
		ev as MaterializedNodeEvent,
		codecs,
	);

	const r = tryCanonicalizeSplitPathToDestination(sp, policy, intent, codecs);
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

export const tryCanonicalizeSplitPathToDestination = (
	sp: SplitPathInsideLibrary,
	policy: ChangePolicy,
	intent: RenameIntent | undefined, // undefined = not rename
	codecs: Codecs,
): Result<CanonicalSplitPathInsideLibrary, string> => {
	const effectivePolicy =
		intent === RenameIntent.Rename ? ChangePolicy.PathKing : policy;

	// Always start by parsing the basename into (coreName, suffixFromName)
	const sepRes = adaptCodecResult(
		codecs.canonicalSplitPath.parseSeparatedSuffix(sp.basename),
	);
	if (sepRes.isErr()) return err(sepRes.error);

	// --- PathKing: pathParts are source of truth, build canonical from them
	if (effectivePolicy === ChangePolicy.PathKing) {
		// Validate pathParts first
		// Empty pathParts is allowed only for Library root folder
		if (sp.pathParts.length > 0) {
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
		// Use codec to build canonical split path
		return adaptCodecResult(
			codecs.canonicalSplitPath.splitPathInsideLibraryToCanonical(sp),
		);
	}

	// --- NameKing: interpret basename as path intent, then OUTPUT PathKing-canonical split path

	// Helper: finalize by rebuilding canonical separated+basename using codec
	const finalize = (
		next: SplitPathInsideLibrary,
	): Result<CanonicalSplitPathInsideLibrary, string> => {
		return adaptCodecResult(
			codecs.canonicalSplitPath.splitPathInsideLibraryToCanonical(next),
		);
	};

	// MOVE-by-name (NameKing): suffix defines the new path
	if (intent === RenameIntent.Move) {
		const libraryRoot = sp.pathParts[0];
		if (!libraryRoot) return err("Expected Library root in pathParts");

		const { coreName, suffixParts } = sepRes.value;

		// Empty suffix = move to Library root
		// Example: Library/R3/S3/Note-S3-R3.md → Library/R3/S3/Note.md
		//          → Library/Note.md (no suffix = root)
		if (suffixParts.length === 0) {
			return finalize({
				...sp,
				basename: coreName,
				pathParts: [libraryRoot],
			});
		}

		// Non-empty suffix: move to suffix location
		// Example: Library/RootNote2.md → Library/RootNote2-P-Q.md
		//          → Library/Q/P/RootNote2-P-Q.md (suffix reversed = path)
		const pathFromSuffix = [...suffixParts].reverse();
		return finalize({
			...sp,
			basename: coreName,
			pathParts: [libraryRoot, ...pathFromSuffix],
		});
	}

	// Regular NameKing (Create / non-move):
	// interpret basename suffix chain as parent chain
	// coreName stays nodeName; suffixParts become extra parent sections
	const convertedPathParts = codecs.canonicalSplitPath.suffixPartsToPathParts(
		sepRes.value.suffixParts,
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
