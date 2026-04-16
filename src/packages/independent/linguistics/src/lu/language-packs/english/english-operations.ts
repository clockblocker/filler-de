import type { LanguageOperationPack } from "../../internal/operations/operation-pack-registry";

export const englishOperationPack: LanguageOperationPack<"English"> = {
	normalizeLemmaSurface: (lemma) => lemma.canonicalLemma,
};
