import type { LanguageOperationPack } from "../../internal/operations/operation-pack-registry";

export const germanOperationPack: LanguageOperationPack<"German"> = {
	normalizeLemmaSurface: (lemma) => lemma.canonicalLemma,
};
