import type { EntrySection } from "../../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../../lemma/types";
import type { GenerationTargetLanguage } from "../section-generation-types";

export type AttestationSectionContext = {
	lemmaResult: LemmaResult;
	targetLang: GenerationTargetLanguage;
};

export function generateAttestationSection(
	ctx: AttestationSectionContext,
): EntrySection {
	return {
		content: ctx.lemmaResult.attestation.source.ref,
		kind: cssSuffixFor[DictSectionKind.Attestation],
		title: TitleReprFor[DictSectionKind.Attestation][ctx.targetLang],
	};
}
