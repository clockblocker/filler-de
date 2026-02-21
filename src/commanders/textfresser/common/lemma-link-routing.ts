import type { SurfaceKind } from "../../../linguistics/common/enums/core";
import { LANGUAGE_ISO_CODE } from "../../../linguistics/common/enums/core";
import type { DeLexemPos } from "../../../linguistics/de";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TargetLanguage } from "../../../types";
import { computeShardedFolderParts } from "./sharded-path";
import type { PathLookupFn } from "./target-path-resolver";

const CLOSED_SET_POS: ReadonlySet<DeLexemPos> = new Set([
	"Pronoun",
	"Article",
	"Preposition",
	"Conjunction",
	"Particle",
	"InteractionalUnit",
]);

type LinkpathResolver = (
	linkpath: string,
	from: SplitPathToMdFile,
) => SplitPathToMdFile | null;

export type ComputedLinkTarget = {
	splitPath: SplitPathToMdFile;
	linkTarget: string;
	shouldCreatePlaceholder: boolean;
};

type PrePromptTargetParams = {
	surface: string;
	sourcePath: SplitPathToMdFile;
	targetLanguage: TargetLanguage;
	resolveLinkpathDest: LinkpathResolver;
	lookupInLibrary: PathLookupFn;
};

type FinalTargetParams = {
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: DeLexemPos | null;
	surfaceKind: SurfaceKind;
	targetLanguage: TargetLanguage;
	findByBasename: (basename: string) => SplitPathToMdFile[];
	lookupInLibrary: PathLookupFn;
};

type PolicyDestinationParams = {
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: DeLexemPos | null;
	surfaceKind: SurfaceKind;
	targetLanguage: TargetLanguage;
};

type FormatLinkTargetOpts = {
	libraryTargetStyle?: "full-path" | "basename";
};

export function isClosedSetPos(pos: DeLexemPos): boolean {
	return CLOSED_SET_POS.has(pos);
}

export function buildClosedSetLibraryPath(
	lemma: string,
	targetLanguage: TargetLanguage,
	pos: DeLexemPos,
): SplitPathToMdFile {
	return {
		basename: lemma,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: [
			"Library",
			LANGUAGE_ISO_CODE[targetLanguage],
			toPosKebab(pos),
		],
	};
}

export function buildOpenClassWorterPath(
	lemma: string,
	targetLanguage: TargetLanguage,
	linguisticUnit: "Lexem" | "Phrasem",
	surfaceKind: SurfaceKind,
): SplitPathToMdFile {
	return {
		basename: lemma,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: computeShardedFolderParts(
			lemma,
			targetLanguage,
			linguisticUnit,
			surfaceKind,
		),
	};
}

export function buildPolicyDestinationPath(
	params: PolicyDestinationParams,
): SplitPathToMdFile {
	const { lemma, linguisticUnit, posLikeKind, surfaceKind, targetLanguage } =
		params;

	if (
		linguisticUnit === "Lexem" &&
		posLikeKind &&
		isClosedSetPos(posLikeKind)
	) {
		return buildClosedSetLibraryPath(lemma, targetLanguage, posLikeKind);
	}

	return buildOpenClassWorterPath(
		lemma,
		targetLanguage,
		linguisticUnit,
		surfaceKind,
	);
}

export function formatLinkTarget(
	splitPath: SplitPathToMdFile,
	opts?: FormatLinkTargetOpts,
): string {
	const libraryTargetStyle = opts?.libraryTargetStyle ?? "basename";

	if (isLibraryPath(splitPath) && libraryTargetStyle === "full-path") {
		return [...splitPath.pathParts, splitPath.basename].join("/");
	}

	return splitPath.basename;
}

function splitPathKey(splitPath: SplitPathToMdFile): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}

function resolveLibraryRenderStyle(params: {
	findByBasename: (basename: string) => SplitPathToMdFile[];
	splitPath: SplitPathToMdFile;
}): "full-path" | "basename" {
	if (!isLibraryPath(params.splitPath)) {
		return "basename";
	}

	const matches = params.findByBasename(params.splitPath.basename);
	const uniqueMatchKeys = new Set(
		matches.map((match) => splitPathKey(match)),
	);
	if (uniqueMatchKeys.size <= 1) {
		return "basename";
	}

	return "full-path";
}

function formatResolvedTarget(params: {
	findByBasename: (basename: string) => SplitPathToMdFile[];
	splitPath: SplitPathToMdFile;
}): string {
	const libraryTargetStyle = resolveLibraryRenderStyle(params);
	return formatLinkTarget(params.splitPath, { libraryTargetStyle });
}

export function computePrePromptTarget(
	params: PrePromptTargetParams,
): ComputedLinkTarget {
	const {
		surface,
		sourcePath,
		targetLanguage,
		resolveLinkpathDest,
		lookupInLibrary,
	} = params;

	const fromResolver = resolveLinkpathDest(surface, sourcePath);
	if (fromResolver) {
		return {
			linkTarget: formatResolvedTarget({
				findByBasename: lookupInLibrary,
				splitPath: fromResolver,
			}),
			shouldCreatePlaceholder: false,
			splitPath: fromResolver,
		};
	}

	const libraryMatch = lookupInLibrary(surface)[0];
	if (libraryMatch) {
		return {
			linkTarget: formatResolvedTarget({
				findByBasename: lookupInLibrary,
				splitPath: libraryMatch,
			}),
			shouldCreatePlaceholder: false,
			splitPath: libraryMatch,
		};
	}

	const placeholderPath = buildOpenClassWorterPath(
		surface,
		targetLanguage,
		"Lexem",
		"Lemma",
	);

	return {
		linkTarget: formatLinkTarget(placeholderPath),
		shouldCreatePlaceholder: true,
		splitPath: placeholderPath,
	};
}

export function computeFinalTarget(
	params: FinalTargetParams,
): ComputedLinkTarget {
	const {
		lemma,
		linguisticUnit,
		posLikeKind,
		surfaceKind,
		targetLanguage,
		findByBasename,
		lookupInLibrary,
	} = params;

	const isClosedSetLexem =
		linguisticUnit === "Lexem" &&
		posLikeKind !== null &&
		isClosedSetPos(posLikeKind);

	const existingMatches = findByBasename(lemma);

	if (isClosedSetLexem) {
		const libraryMatch = existingMatches.find(isLibraryPath);
		if (libraryMatch) {
			return {
				linkTarget: formatResolvedTarget({
					findByBasename,
					splitPath: libraryMatch,
				}),
				shouldCreatePlaceholder: false,
				splitPath: libraryMatch,
			};
		}

		const fromLibraryLookup = lookupInLibrary(lemma)[0];
		if (fromLibraryLookup) {
			return {
				linkTarget: formatResolvedTarget({
					findByBasename,
					splitPath: fromLibraryLookup,
				}),
				shouldCreatePlaceholder: false,
				splitPath: fromLibraryLookup,
			};
		}
	}

	if (!isClosedSetLexem) {
		const worterMatch = existingMatches.find(isWorterPath);
		if (worterMatch) {
			return {
				linkTarget: formatLinkTarget(worterMatch),
				shouldCreatePlaceholder: false,
				splitPath: worterMatch,
			};
		}
	}

	const computed = buildPolicyDestinationPath({
		lemma,
		linguisticUnit,
		posLikeKind,
		surfaceKind,
		targetLanguage,
	});

	return {
		linkTarget: formatResolvedTarget({
			findByBasename,
			splitPath: computed,
		}),
		shouldCreatePlaceholder: false,
		splitPath: computed,
	};
}

function isLibraryPath(splitPath: SplitPathToMdFile): boolean {
	return splitPath.pathParts[0] === "Library";
}

function isWorterPath(splitPath: SplitPathToMdFile): boolean {
	return splitPath.pathParts[0] === "Worter";
}

function toPosKebab(pos: DeLexemPos): string {
	return pos.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
