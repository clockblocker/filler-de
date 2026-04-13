import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { stringifySplitPath } from "../../../stateless-helpers/split-path-comparison";
import type { TargetLanguage } from "../../../types";
import {
	TARGET_LANGUAGE_CODE,
	type POS as LexicalPos,
} from "../domain/note-linguistic-policy";

const POS_SUFFIX_BY_POS: Partial<Record<LexicalPos, readonly string[]>> = {
	ADP: ["praeposition", "preposition"],
	CCONJ: ["konjunktion", "conjunction"],
	DET: ["artikel", "article"],
	// TODO: Confirm canonical Librarian suffix for InteractionalUnit and trim aliases.
	INTJ: [
		"interaktionale-einheit",
		"interjection",
		"interjektion",
		"interactional-unit",
	],
	PART: ["partikel", "particle"],
	PRON: ["pronomen", "pronoun"],
};

type ResolveClosedSetLibraryTargetParams = {
	candidates: ReadonlyArray<SplitPathToMdFile>;
	posLikeKind: LexicalPos;
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
		TARGET_LANGUAGE_CODE[params.targetLanguage],
	);
	const languageMatches = filterByLanguageSuffix(
		dedupedLibraryCandidates,
		expectedLanguageSuffix,
	);
	const languageScopedCandidates =
		languageMatches.length > 0 ? languageMatches : dedupedLibraryCandidates;

	const expectedPosSuffixes = POS_SUFFIX_BY_POS[params.posLikeKind] ?? [];
	if (expectedPosSuffixes.length === 0) {
		return sortDeterministically(languageScopedCandidates)[0] ?? null;
	}

	const posFiltered = filterByPosSuffix(
		languageScopedCandidates,
		expectedPosSuffixes,
	);
	if (posFiltered.length === 0) {
		return null;
	}

	return sortDeterministically(posFiltered)[0] ?? null;
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
	return candidates.filter(
		(candidate) => getLanguageSuffix(candidate) === expectedLanguageSuffix,
	);
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
