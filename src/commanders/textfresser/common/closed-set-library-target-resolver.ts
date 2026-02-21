import { LANGUAGE_ISO_CODE } from "../../../linguistics/common/enums/core";
import type { DeLexemPos } from "../../../linguistics/de";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { stringifySplitPath } from "../../../stateless-helpers/split-path-comparison";
import type { TargetLanguage } from "../../../types";

const POS_SUFFIX_BY_POS: Partial<Record<DeLexemPos, readonly string[]>> = {
	Article: ["artikel", "article"],
	Conjunction: ["konjunktion", "conjunction"],
	Particle: ["partikel", "particle"],
	Preposition: ["praeposition", "preposition"],
	Pronoun: ["pronomen", "pronoun"],
};

type ResolveClosedSetLibraryTargetParams = {
	candidates: ReadonlyArray<SplitPathToMdFile>;
	posLikeKind: DeLexemPos;
	targetLanguage: TargetLanguage;
};

export function resolveClosedSetLibraryTarget(
	params: ResolveClosedSetLibraryTargetParams,
): SplitPathToMdFile | null {
	const dedupedLibraryCandidates = dedupeLibraryCandidates(params.candidates);
	if (dedupedLibraryCandidates.length === 0) {
		return null;
	}

	const expectedLanguageSuffix = normalizeToken(
		LANGUAGE_ISO_CODE[params.targetLanguage],
	);
	const languageFiltered = filterByLanguageSuffix(
		dedupedLibraryCandidates,
		expectedLanguageSuffix,
	);

	const expectedPosSuffixes = POS_SUFFIX_BY_POS[params.posLikeKind] ?? [];
	const posFiltered =
		expectedPosSuffixes.length > 0
			? filterByPosSuffix(languageFiltered, expectedPosSuffixes)
			: [];

	const narrowed =
		posFiltered.length > 0
			? posFiltered
			: languageFiltered.length > 0
				? languageFiltered
				: dedupedLibraryCandidates;

	return sortDeterministically(narrowed)[0] ?? null;
}

function dedupeLibraryCandidates(
	candidates: ReadonlyArray<SplitPathToMdFile>,
): SplitPathToMdFile[] {
	const deduped: SplitPathToMdFile[] = [];
	const seen = new Set<string>();

	for (const candidate of candidates) {
		if (candidate.pathParts[0] !== "Library") {
			continue;
		}

		const key = stringifySplitPath(candidate);
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		deduped.push(candidate);
	}

	return deduped;
}

function getSuffixPartsFromPath(splitPath: SplitPathToMdFile): string[] {
	if (splitPath.pathParts[0] !== "Library") {
		return [];
	}
	return splitPath.pathParts.slice(1).reverse().map(normalizeToken);
}

function getLanguageSuffix(splitPath: SplitPathToMdFile): string | null {
	const suffixParts = getSuffixPartsFromPath(splitPath);
	return suffixParts[suffixParts.length - 1] ?? null;
}

function getPosSuffix(splitPath: SplitPathToMdFile): string | null {
	const suffixParts = getSuffixPartsFromPath(splitPath);
	if (suffixParts.length < 2) {
		return null;
	}
	return suffixParts[suffixParts.length - 2] ?? null;
}

function filterByLanguageSuffix(
	candidates: ReadonlyArray<SplitPathToMdFile>,
	expectedLanguageSuffix: string,
): SplitPathToMdFile[] {
	const matched = candidates.filter(
		(candidate) => getLanguageSuffix(candidate) === expectedLanguageSuffix,
	);
	return matched.length > 0 ? matched : [...candidates];
}

function filterByPosSuffix(
	candidates: ReadonlyArray<SplitPathToMdFile>,
	expectedPosSuffixes: ReadonlyArray<string>,
): SplitPathToMdFile[] {
	const allowed = new Set(expectedPosSuffixes.map(normalizeToken));
	return candidates.filter((candidate) => {
		const posSuffix = getPosSuffix(candidate);
		return posSuffix !== null && allowed.has(posSuffix);
	});
}

function sortDeterministically(
	candidates: ReadonlyArray<SplitPathToMdFile>,
): SplitPathToMdFile[] {
	return [...candidates].sort((left, right) => {
		const byBasename = left.basename.localeCompare(right.basename, "de");
		if (byBasename !== 0) {
			return byBasename;
		}
		return stringifySplitPath(left).localeCompare(
			stringifySplitPath(right),
			"en",
		);
	});
}

function normalizeToken(value: string): string {
	return value.trim().toLocaleLowerCase("de-DE");
}
