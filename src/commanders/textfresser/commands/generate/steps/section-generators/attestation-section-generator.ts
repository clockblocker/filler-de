import { cssSuffixFor } from "../../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../../linguistics/common/sections/section-kind";
import type { EntrySection } from "../../../../../../stateless-helpers/dict-note/types";
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
