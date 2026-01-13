import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../../../../global-state/global-state";
import { SplitPathKind } from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	AnySplitPathInsideLibrary,
	CanonicalSplitPathInsideLibrary,
	Codecs,
	SplitPathInsideLibraryOf,
} from "../../../../../../../../codecs";
import type {
	CanonicalSplitPathInsideLibraryOf,
	SplitPathInsideLibraryWithSeparatedSuffixOf,
} from "../../../../../../../../codecs/canonical-split-path/types/canonical-split-path";
import type { NodeName } from "../../../../../../../../types/schemas/node-name";
import {
	buildCanonicalSeparatedSuffixedBasename,
	canonizeSplitPathWithSeparatedSuffix,
} from "../../../../../utils/canonical-naming/canonicalization-policy";
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
	SK extends SplitPathKind,
>(
	sp: SplitPathInsideLibraryOf<SK>,
	codecs: Codecs,
): Result<TreeNodeLocatorForLibraryScopedSplitPath<SK>, string> {
	const cspRes = adaptCodecResult(
		codecs.canonicalSplitPath.splitPathInsideLibraryToCanonical(sp),
	);
	if (cspRes.isErr()) return err(cspRes.error);

	const locatorRes = adaptCodecResult(
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value),
	);
	if (locatorRes.isErr()) return err(locatorRes.error);

	return ok(locatorRes.value as TreeNodeLocatorForLibraryScopedSplitPath<SK>);
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

/**
 * Extracts duplicate marker (e.g., " 1", " 2") from end of basename.
 * Obsidian appends " N" when duplicating files.
 */
function extractDuplicateMarker(basename: string): {
	cleanBasename: string;
	marker: string;
} {
	const match = basename.match(/^(.+?)( \d+)$/);
	if (match) {
		return { cleanBasename: match[1] ?? basename, marker: match[2] ?? "" };
	}
	return { cleanBasename: basename, marker: "" };
}

export function tryCanonicalizeSplitPathToDestination<SK extends SplitPathKind>(
	sp: SplitPathInsideLibraryOf<SK>,
	policy: ChangePolicy,
	intent: RenameIntent | undefined, // undefined = not rename
	codecs: Codecs,
): Result<CanonicalSplitPathInsideLibraryOf<SK>, string>;
export function tryCanonicalizeSplitPathToDestination(
	sp: AnySplitPathInsideLibrary,
	policy: ChangePolicy,
	intent: RenameIntent | undefined, // undefined = not rename
	codecs: Codecs,
): Result<CanonicalSplitPathInsideLibrary, string>;
export function tryCanonicalizeSplitPathToDestination<SK extends SplitPathKind>(
	sp: AnySplitPathInsideLibrary,
	policy: ChangePolicy,
	intent: RenameIntent | undefined, // undefined = not rename
	codecs: Codecs,
): Result<
	CanonicalSplitPathInsideLibraryOf<SK> | CanonicalSplitPathInsideLibrary,
	string
> {
	const effectivePolicy =
		intent === RenameIntent.Rename ? ChangePolicy.PathKing : policy;

	// --- PathKing: pathParts are source of truth, build canonical from them
	if (effectivePolicy === ChangePolicy.PathKing) {
		// Convert to split path with separated suffix (validates NodeNames)
		const withSeparatedSuffixResult = adaptCodecResult(
			codecs.canonicalSplitPath.splitPathInsideLibraryToWithSeparatedSuffix(
				sp,
			),
		);
		if (withSeparatedSuffixResult.isErr()) {
			return err(withSeparatedSuffixResult.error);
		}
		let spWithSeparatedSuffix =
			withSeparatedSuffixResult.value as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;

		// Handle Obsidian duplicate marker (business logic)
		// Extract duplicate marker and re-attach to coreName
		const { cleanBasename, marker } = extractDuplicateMarker(sp.basename);
		if (marker) {
			// Re-parse without duplicate marker to get clean coreName
			const cleanSepRes = adaptCodecResult(
				codecs.canonicalSplitPath.parseSeparatedSuffix(cleanBasename),
			);
			if (cleanSepRes.isErr()) return err(cleanSepRes.error);
			// Re-attach marker to coreName
			const coreNameWithMarker = (cleanSepRes.value.coreName +
				marker) as NodeName;
			spWithSeparatedSuffix = {
				...spWithSeparatedSuffix,
				separatedSuffixedBasename: {
					coreName: coreNameWithMarker,
					suffixParts: cleanSepRes.value.suffixParts,
				},
			} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;
		}

		// Build expected canonical separated suffix from pathParts (policy)
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRootName = splitPathToLibraryRoot.basename;
		const expected = buildCanonicalSeparatedSuffixedBasename(
			codecs.canonicalSplitPath as unknown as Parameters<
				typeof buildCanonicalSeparatedSuffixedBasename
			>[0],
			libraryRootName,
			spWithSeparatedSuffix.separatedSuffixedBasename.coreName,
			spWithSeparatedSuffix,
		);

		// Update suffixParts to match canonical (from pathParts)
		spWithSeparatedSuffix = {
			...spWithSeparatedSuffix,
			separatedSuffixedBasename: expected.separatedSuffixedBasename,
		} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;

		// Canonize using policy (validates format)
		const canonizedResult = canonizeSplitPathWithSeparatedSuffix(
			codecs.canonicalSplitPath as unknown as Parameters<
				typeof canonizeSplitPathWithSeparatedSuffix
			>[0],
			libraryRootName,
			spWithSeparatedSuffix,
		);
		if (canonizedResult.isErr()) {
			return err(canonizedResult.error.message);
		}

		return ok(
			canonizedResult.value as unknown as
				| CanonicalSplitPathInsideLibraryOf<SK>
				| CanonicalSplitPathInsideLibrary,
		);
	}

	// --- NameKing: interpret basename as path intent, then OUTPUT PathKing-canonical split path

	// Always start by parsing the basename into (coreName, suffixFromName)
	const sepRes = adaptCodecResult(
		codecs.canonicalSplitPath.parseSeparatedSuffix(sp.basename),
	);
	if (sepRes.isErr()) return err(sepRes.error);

	// Helper: finalize by rebuilding canonical separated+basename using codec
	const finalize = <SK extends SplitPathKind>(
		next: SplitPathInsideLibraryOf<SK>,
	): Result<CanonicalSplitPathInsideLibraryOf<SK>, string> => {
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
		const finalPathParts = [libraryRoot, ...pathFromSuffix];
		// Build canonical basename: coreName + suffixParts derived from final pathParts (reversed)
		// For folders, suffixParts are always empty in canonical format
		const finalSuffixParts =
			sp.kind === SplitPathKind.Folder
				? []
				: codecs.canonicalSplitPath.pathPartsWithRootToSuffixParts(
						finalPathParts,
					);
		const canonicalBasename =
			codecs.canonicalSplitPath.serializeSeparatedSuffix({
				coreName,
				suffixParts: finalSuffixParts,
			});
		return finalize({
			...sp,
			basename: canonicalBasename,
			pathParts: finalPathParts,
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

	// Build canonical basename: coreName + suffixParts derived from nextPathParts (reversed)
	// For folders, suffixParts are always empty in canonical format
	const finalSuffixParts =
		sp.kind === SplitPathKind.Folder
			? []
			: codecs.canonicalSplitPath.pathPartsWithRootToSuffixParts(
					nextPathParts,
				);
	const canonicalBasename =
		codecs.canonicalSplitPath.serializeSeparatedSuffix({
			coreName: sepRes.value.coreName,
			suffixParts: finalSuffixParts,
		});

	return finalize({
		...sp,
		basename: canonicalBasename,
		pathParts: nextPathParts,
	});
}
