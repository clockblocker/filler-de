import { englishOperationPack } from "../../language-packs/english/english-operations";
import { germanOperationPack } from "../../language-packs/german/german-operations";
import { hebrewOperationPack } from "../../language-packs/hebrew/hebrew-operations";
import type { TargetLanguage } from "../../universal/enums/core/language";
import type { LemmaLike, SurfaceLike } from "./shared";

export type LanguageOperationPack<L extends TargetLanguage> = {
	normalizeLemmaSurface: (lemma: LemmaLike<L>) => string;
	defaultSpelledSelectionFromSurface?: (surface: SurfaceLike<L>) => string;
	getDefaultInflectionFeatures?: (
		lemma: LemmaLike<L>,
	) => Record<string, unknown>;
};

const operationPackByLanguage = {
	English: englishOperationPack,
	German: germanOperationPack,
	Hebrew: hebrewOperationPack,
} satisfies {
	[L in TargetLanguage]: LanguageOperationPack<L>;
};

export function getOperationPack<L extends TargetLanguage>(
	language: L,
): LanguageOperationPack<L> {
	return operationPackByLanguage[
		language
	] as unknown as LanguageOperationPack<L>;
}
