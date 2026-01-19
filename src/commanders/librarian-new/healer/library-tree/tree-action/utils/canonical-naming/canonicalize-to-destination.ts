import { err, ok, type Result } from "neverthrow";
import type { SplitPathKind } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type {
	AnySplitPathInsideLibrary,
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
	Codecs,
	SplitPathInsideLibraryOf,
	SplitPathInsideLibraryWithSeparatedSuffixOf,
} from "../../../../../codecs";
import type { NodeName } from "../../../../../types/schemas/node-name";
import { adaptCodecResult } from "../../bulk-vault-action-adapter/layers/translate-material-event/error-adapters";
import {
	ChangePolicy,
	RenameIntent,
} from "../../bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent";
import {
	buildCanonicalSeparatedSuffixedBasename,
	canonizeSplitPathWithSeparatedSuffix,
} from "./canonicalization-policy";

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
			codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
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
				codecs.suffix.parseSeparatedSuffix(cleanBasename),
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
			codecs.suffix,
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
			codecs.suffix,
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

	// Convert to split path with separated suffix (validates NodeNames)
	const withSeparatedSuffixResult = adaptCodecResult(
		codecs.splitPathWithSeparatedSuffix.splitPathInsideLibraryToWithSeparatedSuffix(
			sp,
		),
	);
	if (withSeparatedSuffixResult.isErr()) {
		return err(withSeparatedSuffixResult.error);
	}
	let spWithSeparatedSuffix =
		withSeparatedSuffixResult.value as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;

	// Handle duplicate markers (business logic)
	const { cleanBasename, marker } = extractDuplicateMarker(sp.basename);
	if (marker) {
		const cleanSepRes = adaptCodecResult(
			codecs.suffix.parseSeparatedSuffix(cleanBasename),
		);
		if (cleanSepRes.isErr()) return err(cleanSepRes.error);
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

	const { coreName, suffixParts } =
		spWithSeparatedSuffix.separatedSuffixedBasename;
	const libraryRoot = sp.pathParts[0];
	if (!libraryRoot) return err("Expected Library root in pathParts");

	// MOVE-by-name (NameKing): suffix defines the new path
	if (intent === RenameIntent.Move) {
		// Empty suffix = move to Library root
		// Example: Library/R3/S3/Note-S3-R3.md → Library/R3/S3/Note.md
		//          → Library/Note.md (no suffix = root)
		if (suffixParts.length === 0) {
			spWithSeparatedSuffix = {
				...spWithSeparatedSuffix,
				pathParts: [libraryRoot],
			} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;
		} else {
			// Non-empty suffix: move to suffix location
			// For FOLDERS: suffix is RELATIVE to parent (append to current path)
			//   Example: Library/Recipe/Berry_Pie → Library/Recipe/Berry-Pie
			//            → Library/Recipe/Pie/Berry/ (suffix appended to parent context)
			// For FILES: suffix is ABSOLUTE (from Library root)
			//   Example: Library/A/B/Note-C.md → Library/C/Note-C.md
			const pathFromSuffix =
				codecs.suffix.suffixPartsToPathParts(suffixParts);
			const isFolder = sp.kind === "Folder";
			const basePath = isFolder ? sp.pathParts : [libraryRoot];
			spWithSeparatedSuffix = {
				...spWithSeparatedSuffix,
				pathParts: [...basePath, ...pathFromSuffix],
			} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;
		}
	} else {
		// Regular NameKing (Create / non-move):
		// interpret basename suffix chain as parent chain
		// coreName stays nodeName; suffixParts become extra parent sections
		const convertedPathParts = codecs.suffix.suffixPartsToPathParts(
			suffixParts,
		) as NodeName[];
		spWithSeparatedSuffix = {
			...spWithSeparatedSuffix,
			pathParts: [libraryRoot, ...convertedPathParts],
		} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;
	}

	// Build expected canonical separated suffix from new pathParts (policy)
	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const libraryRootName = splitPathToLibraryRoot.basename;
	const expected = buildCanonicalSeparatedSuffixedBasename(
		codecs.suffix,
		libraryRootName,
		coreName,
		spWithSeparatedSuffix,
	);

	// Update suffixParts to match canonical (from pathParts)
	spWithSeparatedSuffix = {
		...spWithSeparatedSuffix,
		separatedSuffixedBasename: expected.separatedSuffixedBasename,
	} as SplitPathInsideLibraryWithSeparatedSuffixOf<SplitPathKind>;

	// Canonize using policy (validates format)
	const canonizedResult = canonizeSplitPathWithSeparatedSuffix(
		codecs.suffix,
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
