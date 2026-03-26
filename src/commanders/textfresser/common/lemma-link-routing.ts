import type { SurfaceKind } from "../../../linguistics/common/enums/core";
import { LANGUAGE_ISO_CODE } from "../../../linguistics/common/enums/core";
import type { LexicalPos } from "../../../lexical-generation";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TargetLanguage } from "../../../types";
import { resolveClosedSetLibraryTarget } from "./closed-set-library-target-resolver";
import {
	computeShardedFolderParts,
	computeShardSegments,
} from "./sharded-path";
import type { PathLookupFn } from "./target-path-resolver";

const CLOSED_SET_POS: ReadonlySet<LexicalPos> = new Set<LexicalPos>([
	"Pronoun",
	"Article",
	"Preposition",
	"Conjunction",
	"Particle",
	"InteractionalUnit",
]);
const UNKNOWN_WORKING_SEGMENT = "unknown";

type LinkpathResolver = (
	linkpath: string,
	from: SplitPathToMdFile,
) => SplitPathToMdFile | null;

export type ComputedLinkTarget = {
	splitPath: SplitPathToMdFile;
	linkTarget: string;
	linkTargetSplitPath: SplitPathToMdFile;
	shouldCreatePlaceholder: boolean;
};

type PrePromptTargetParams = {
	surface: string;
	sourcePath: SplitPathToMdFile;
	targetLanguage: TargetLanguage;
	findByBasename: (basename: string) => SplitPathToMdFile[];
	resolveLinkpathDest: LinkpathResolver;
	lookupInLibrary?: PathLookupFn;
};

type FinalTargetParams = {
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: LexicalPos | null;
	surfaceKind: SurfaceKind;
	targetLanguage: TargetLanguage;
	findByBasename: (basename: string) => SplitPathToMdFile[];
	lookupInLibrary: PathLookupFn;
};

type PolicyDestinationParams = {
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: LexicalPos | null;
	surfaceKind: SurfaceKind;
	targetLanguage: TargetLanguage;
};

export function isClosedSetPos(pos: LexicalPos): boolean {
	return CLOSED_SET_POS.has(pos);
}

function buildOpenClassWorterPath(
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
	const { lemma, linguisticUnit, surfaceKind, targetLanguage } = params;
	return buildOpenClassWorterPath(
		lemma,
		targetLanguage,
		linguisticUnit,
		surfaceKind,
	);
}

export function formatLinkTarget(splitPath: SplitPathToMdFile): string {
	return splitPath.basename;
}

export function computePrePromptTarget(
	params: PrePromptTargetParams,
): ComputedLinkTarget {
	const { findByBasename, resolveLinkpathDest, sourcePath, targetLanguage } =
		params;
	const surface = normalizeSurface(params.surface);
	if (isSingleTokenSurface(surface)) {
		const fromWorter = resolveReusableWorterHost({
			findByBasename,
			resolveLinkpathDest,
			sourcePath,
			surface,
			targetLanguage,
		});
		if (fromWorter) {
			return {
				linkTarget: formatLinkTarget(fromWorter),
				linkTargetSplitPath: fromWorter,
				shouldCreatePlaceholder: false,
				splitPath: fromWorter,
			};
		}
	}

	const unknownWorkingPath = buildUnknownWorkingPath(surface, targetLanguage);
	return {
		linkTarget: formatLinkTarget(unknownWorkingPath),
		linkTargetSplitPath: unknownWorkingPath,
		shouldCreatePlaceholder: true,
		splitPath: unknownWorkingPath,
	};
}

function resolveReusableWorterHost(params: {
	surface: string;
	sourcePath: SplitPathToMdFile;
	targetLanguage: TargetLanguage;
	findByBasename: (basename: string) => SplitPathToMdFile[];
	resolveLinkpathDest: LinkpathResolver;
}): SplitPathToMdFile | null {
	for (const candidate of buildLookupCandidates(params.surface)) {
		const fromResolver = params.resolveLinkpathDest(
			candidate,
			params.sourcePath,
		);
		if (
			fromResolver &&
			isWorterPathForLanguage(fromResolver, params.targetLanguage) &&
			!isUnknownWorkingPath(fromResolver)
		) {
			return fromResolver;
		}

		const byBasename = params
			.findByBasename(candidate)
			.find(
				(splitPath) =>
					isWorterPathForLanguage(splitPath, params.targetLanguage) &&
					!isUnknownWorkingPath(splitPath),
			);
		if (byBasename) {
			return byBasename;
		}
	}

	return null;
}

function buildUnknownWorkingPath(
	surface: string,
	targetLanguage: TargetLanguage,
): SplitPathToMdFile {
	const normalizedSurface = normalizeSurface(surface);
	// Keep unknown working notes sharded to avoid hot-folder collisions during parallel runs.
	const segments = computeShardSegments(normalizedSurface);
	const first = segments[0] ?? "_";
	const prefix = segments[1] ?? first;
	const shard = segments[2] ?? prefix;
	return {
		basename: normalizedSurface,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: [
			"Worter",
			LANGUAGE_ISO_CODE[targetLanguage],
			UNKNOWN_WORKING_SEGMENT,
			first,
			prefix,
			shard,
		],
	};
}

function isSingleTokenSurface(surface: string): boolean {
	const normalized = normalizeSurface(surface);
	return normalized.length > 0 && !/\s/u.test(normalized);
}

function normalizeSurface(surface: string): string {
	return surface.trim();
}

function buildLookupCandidates(word: string): string[] {
	const candidates = [word];
	const firstChar = word.charAt(0);
	if (firstChar.length === 0) {
		return candidates;
	}
	// TODO: Use active dictionary language locale instead of hardcoded German.
	const decapitalized = firstChar.toLocaleLowerCase("de-DE") + word.slice(1);
	if (decapitalized !== word) {
		candidates.push(decapitalized);
	}
	return candidates;
}

export function isUnknownWorkingPath(splitPath: SplitPathToMdFile): boolean {
	return (
		splitPath.pathParts[0] === "Worter" &&
		splitPath.pathParts[2] === UNKNOWN_WORKING_SEGMENT
	);
}

function findReusableWorterMatch(
	matches: ReadonlyArray<SplitPathToMdFile>,
	targetLanguage: TargetLanguage,
): SplitPathToMdFile | null {
	return (
		matches.find(
			(splitPath) =>
				isWorterPathForLanguage(splitPath, targetLanguage) &&
				!isUnknownWorkingPath(splitPath),
		) ?? null
	);
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
	const reusableWorterMatch = findReusableWorterMatch(
		existingMatches,
		targetLanguage,
	);

	if (isClosedSetLexem && posLikeKind !== null) {
		const libraryMatch = resolveClosedSetLibraryTarget({
			candidates: [
				...existingMatches.filter(isLibraryPath),
				...lookupInLibrary(lemma),
			],
			posLikeKind,
			targetLanguage,
		});
		const splitPath =
			reusableWorterMatch ??
			buildOpenClassWorterPath(
				lemma,
				targetLanguage,
				linguisticUnit,
				surfaceKind,
			);
		const linkTargetSplitPath = libraryMatch ?? splitPath;

		return {
			linkTarget: formatLinkTarget(linkTargetSplitPath),
			linkTargetSplitPath,
			shouldCreatePlaceholder: false,
			splitPath,
		};
	}

	if (reusableWorterMatch) {
		return {
			linkTarget: formatLinkTarget(reusableWorterMatch),
			linkTargetSplitPath: reusableWorterMatch,
			shouldCreatePlaceholder: false,
			splitPath: reusableWorterMatch,
		};
	}

	const computed = buildPolicyDestinationPath({
		lemma,
		linguisticUnit,
		posLikeKind,
		surfaceKind,
		targetLanguage,
	});

	return {
		linkTarget: formatLinkTarget(computed),
		linkTargetSplitPath: computed,
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

function isWorterPathForLanguage(
	splitPath: SplitPathToMdFile,
	targetLanguage: TargetLanguage,
): boolean {
	return (
		isWorterPath(splitPath) &&
		splitPath.pathParts[1] === LANGUAGE_ISO_CODE[targetLanguage]
	);
}
