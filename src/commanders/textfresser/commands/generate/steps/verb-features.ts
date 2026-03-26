import type {
	LexemFeatures,
	LexicalInfo,
} from "../../../../../lexical-generation";
import { buildGermanVerbEntryIdentity } from "../../../../../linguistics/de";
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
	return buildGermanVerbEntryIdentity({
		conjugation: output.conjugation,
		valency: output.valency,
	});
}
