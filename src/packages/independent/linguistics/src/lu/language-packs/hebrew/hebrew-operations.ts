import type { LanguageOperationPack } from "../../internal/operations/operation-pack-registry";

export const hebrewOperationPack: LanguageOperationPack<"Hebrew"> = {
	normalizeLemmaSurface: (lemma) => lemma.canonicalLemma,
};
