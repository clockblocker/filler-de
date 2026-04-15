import type { LexicalInfo } from "@textfresser/lexical-generation";
import type { InherentFeatures } from "../../../../../deprecated-linguistic-enums";
import { getLexicalInfoInherentFeatures, getLexicalInfoPos } from "../../../domain/lexical-info-view";
import { buildVerbEntryIdentity } from "../../../domain/lexical-types";

export type VerbLexicalFeatures = Pick<InherentFeatures, "reflex" | "separable">;

export function getVerbLexicalFeatures(
	lexicalInfo: LexicalInfo,
): VerbLexicalFeatures | null {
	if (getLexicalInfoPos(lexicalInfo) !== "VERB") {
		return null;
	}

	const inherentFeatures = getLexicalInfoInherentFeatures(lexicalInfo);
	if (!inherentFeatures) {
		return null;
	}

	return {
		reflex: inherentFeatures.reflex,
		separable: inherentFeatures.separable,
	};
}

export function buildVerbEntryIdentityFromFeatures(
	output: VerbLexicalFeatures,
): string {
	return buildVerbEntryIdentity({
		inherentFeatures: output,
	});
}
