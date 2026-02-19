/**
 * Shared path resolution for propagation steps.
 *
 * Two-source lookup: VAM (findByBasename) → Librarian corename index (fallback) → computed sharded path.
 * When an existing file is found in `inflected/` but the desired surface kind is `lemma`,
 * generates a RenameMdFile healing action to move the file.
 */

import type { LinguisticUnitKind } from "../../../linguistics/common/enums/core";
import { SurfaceKind } from "../../../linguistics/common/enums/core";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import type { TargetLanguage } from "../../../types";
import type { MorphemeItem } from "../domain/morpheme/morpheme-formatter";
import {
	computeShardedFolderParts,
	SURFACE_KIND_PATH_INDEX,
} from "./sharded-path";

const WORTER_ROOT = "Worter";

/** Callback for looking up files by surface/corename. Returns SplitPathToMdFile[]. */
export type PathLookupFn = (surface: string) => SplitPathToMdFile[];

export type ResolvedTargetPath = {
	splitPath: SplitPathToMdFile;
	/** RenameMdFile action if inflected→lemma healing is needed, otherwise empty. */
	healingActions: VaultAction[];
};

type ResolveTargetPathParams = {
	word: string;
	targetLanguage: TargetLanguage;
	unitKind: LinguisticUnitKind;
	desiredSurfaceKind: SurfaceKind;
	vamLookup: PathLookupFn;
	librarianLookup: PathLookupFn;
};

type ResolveMorphemePathParams = {
	lookupInLibrary: PathLookupFn;
	targetLang: TargetLanguage;
	vam: { findByBasename: PathLookupFn };
};

/**
 * Resolve the target split path for a propagation target word.
 *
 * 1. VAM lookup (findByBasename) → use first match if found
 * 2. Librarian corename index (fallback) → use first match if found
 * 3. Compute sharded path (fallback)
 *
 * If an existing Worter path is found and it's in `inflected/` but the desired kind is `lemma`,
 * a RenameMdFile healing action is generated to move the file.
 * The inverse (writing inflection to a lemma file) is fine — no healing needed.
 */
export function resolveTargetPath(
	params: ResolveTargetPathParams,
): ResolvedTargetPath {
	const {
		word,
		targetLanguage,
		unitKind,
		desiredSurfaceKind,
		vamLookup,
		librarianLookup,
	} = params;

	// 1. Try VAM lookup
	const vamResults = lookupWithCaseFallback(vamLookup, word);
	if (vamResults.length > 0) {
		const existing = vamResults[0];
		if (existing) {
			return healIfNeeded(
				existing,
				word,
				targetLanguage,
				unitKind,
				desiredSurfaceKind,
				true,
			);
		}
	}

	// 2. Try librarian lookup
	const libResults = lookupWithCaseFallback(librarianLookup, word);
	if (libResults.length > 0) {
		const existing = libResults[0];
		if (existing) {
			// Library matches: use as-is, no healing (Library has its own invariants)
			return { healingActions: [], splitPath: existing };
		}
	}

	// 3. Compute sharded path
	const splitPath = buildComputedSplitPath(
		word,
		targetLanguage,
		unitKind,
		desiredSurfaceKind,
	);
	return { healingActions: [], splitPath };
}

function lookupWithCaseFallback(
	lookup: PathLookupFn,
	word: string,
): SplitPathToMdFile[] {
	for (const candidate of buildLookupCandidates(word)) {
		const results = lookup(candidate);
		if (results.length > 0) {
			return results;
		}
	}
	return [];
}

function buildLookupCandidates(word: string): string[] {
	const candidates = [word];
	const firstChar = word.charAt(0);
	if (firstChar.length === 0) {
		return candidates;
	}
	const decapitalized =
		firstChar.toLocaleLowerCase("de-DE") + word.slice(1);
	if (decapitalized !== word) {
		candidates.push(decapitalized);
	}
	return candidates;
}

/**
 * Build a [UpsertMdFile, ProcessMdFile] action pair for propagation.
 */
export function buildPropagationActionPair(
	splitPath: SplitPathToMdFile,
	transform: (content: string) => string,
): [VaultAction, VaultAction] {
	return [
		{
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath },
		},
		{
			kind: VaultActionKind.ProcessMdFile,
			payload: { splitPath, transform },
		},
	];
}

/**
 * Build a Library split path for a known German prefix.
 * Convention: `Library/de/prefix/{surf}.md`
 */
export function buildPrefixLibraryPath(surf: string): SplitPathToMdFile {
	return {
		basename: surf.toLowerCase(),
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "de", "prefix"],
	};
}

/**
 * Resolve the target split path for a morpheme.
 *
 * - Prefix with linkTarget (known German prefix): try VAM/librarian lookup, fall back to Library path
 * - Others: use standard resolveTargetPath (goes to Wörter)
 */
export function resolveMorphemePath(
	item: MorphemeItem,
	params: ResolveMorphemePathParams,
): ResolvedTargetPath {
	if (item.linkTarget) {
		const vamResults = params.vam.findByBasename(item.linkTarget);
		if (vamResults.length > 0) {
			const existing = vamResults[0];
			if (existing) {
				return { healingActions: [], splitPath: existing };
			}
		}

		const libraryResults = params.lookupInLibrary(item.linkTarget);
		if (libraryResults.length > 0) {
			const existing = libraryResults[0];
			if (existing) {
				return { healingActions: [], splitPath: existing };
			}
		}

		return {
			healingActions: [],
			splitPath: buildPrefixLibraryPath(item.surf),
		};
	}

	return resolveTargetPath({
		desiredSurfaceKind: SurfaceKind.Lemma,
		librarianLookup: params.lookupInLibrary,
		targetLanguage: params.targetLang,
		unitKind: "Morphem",
		vamLookup: (word) => params.vam.findByBasename(word),
		word: item.lemma ?? item.surf,
	});
}

function buildComputedSplitPath(
	word: string,
	targetLanguage: TargetLanguage,
	unitKind: LinguisticUnitKind,
	surfaceKind: SurfaceKind,
): SplitPathToMdFile {
	return {
		basename: word,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: computeShardedFolderParts(
			word,
			targetLanguage,
			unitKind,
			surfaceKind,
		),
	};
}

/**
 * Check if healing is needed for a Worter-sourced path.
 * Healing: existing is `inflected/` but desired is `lemma` → rename to lemma path.
 */
function healIfNeeded(
	existing: SplitPathToMdFile,
	word: string,
	targetLanguage: TargetLanguage,
	unitKind: LinguisticUnitKind,
	desiredSurfaceKind: SurfaceKind,
	isWorterCandidate: boolean,
): ResolvedTargetPath {
	if (!isWorterCandidate) {
		return { healingActions: [], splitPath: existing };
	}

	const pathParts = existing.pathParts;
	const existingSurfaceKind = pathParts[SURFACE_KIND_PATH_INDEX];

	// Only heal if in Worter and existing is inflected but desired is lemma
	if (
		pathParts[0] === WORTER_ROOT &&
		existingSurfaceKind === "inflected" &&
		desiredSurfaceKind.toLowerCase() === "lemma"
	) {
		const newSplitPath = buildComputedSplitPath(
			word,
			targetLanguage,
			unitKind,
			desiredSurfaceKind,
		);
		const renameAction: VaultAction = {
			kind: VaultActionKind.RenameMdFile,
			payload: { from: existing, to: newSplitPath },
		};
		return { healingActions: [renameAction], splitPath: newSplitPath };
	}

	// No healing needed (e.g. writing inflection to a lemma file is fine)
	return { healingActions: [], splitPath: existing };
}
