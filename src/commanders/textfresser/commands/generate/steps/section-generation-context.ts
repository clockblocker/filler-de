import type { LexicalInfo } from "@textfresser/lexical-generation";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import {
	buildLexicalSectionQuery,
	resolveNounInflectionGender,
} from "./lexical-section-query";

/** V3 sections — the ones generated in the current pipeline. */
export const V3_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Morpheme,
	DictSectionKind.Morphology,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
	DictSectionKind.Tags,
]);

export function buildSectionQuery(lexicalInfo: LexicalInfo) {
	return buildLexicalSectionQuery(lexicalInfo);
}

export { resolveNounInflectionGender };
