import type {
	LexemFeatures,
	LexicalInfo,
} from "@textfresser/lexical-generation";
import { buildVerbEntryIdentity } from "../../../domain/lexical-types";
import { normalizeTagPart } from "./tag-normalization";

export type VerbLexicalFeatures = Extract<LexemFeatures, { kind: "verb" }>;

export function getVerbLexicalFeatures(
	lexicalInfo: LexicalInfo,
): VerbLexicalFeatures | null {
	if (lexicalInfo.lemma.linguisticUnit !== "Lexem") {
		return null;
	}
	if (lexicalInfo.features.status !== "ready") {
		return null;
	}
	return lexicalInfo.features.value.kind === "verb"
		? lexicalInfo.features.value
		: null;
}

export function buildVerbFeatureTags(output: VerbLexicalFeatures): string[] {
	const tags = [
		`conjugation-${normalizeTagPart(output.conjugation)}`,
		`separability-${normalizeTagPart(output.valency.separability)}`,
		`reflexivity-${normalizeTagPart(output.valency.reflexivity)}`,
	];

	if (output.valency.governedPreposition) {
		tags.push(
			`prep-${normalizeTagPart(output.valency.governedPreposition)}`,
		);
	}

	return tags;
}

export function buildVerbEntryIdentityFromFeatures(
	output: Pick<VerbLexicalFeatures, "conjugation" | "valency">,
): string {
	return buildVerbEntryIdentity({
		conjugation: output.conjugation,
		valency: output.valency,
	});
}
