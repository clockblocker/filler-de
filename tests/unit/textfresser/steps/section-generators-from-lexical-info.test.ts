import { describe, expect, it } from "bun:test";
import { generateInflectionSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/inflection-section-generator";
import { generateRelationSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/relation-section-generator";
import { generateTagsSection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/tags-section-generator";
import {
	makeLexemeLexicalInfo,
	makeNounInflections,
	makeRelations,
} from "../helpers/native-fixtures";

function makeVerbLexicalInfo() {
	return makeLexemeLexicalInfo({
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🚶"],
				ipa: "ɡeːən",
			},
		},
		features: {
			status: "ready",
			value: {
				inherentFeatures: {
					reflex: true,
					separable: true,
				},
			},
		},
		inflections: {
			status: "ready",
			value: {
				kind: "generic",
				rows: [
					{
						forms: [{ form: "gehe" }, { form: "gehst" }],
						label: "Prasens",
					},
				],
			},
		},
		lemma: "gehen",
		pos: "VERB",
		relations: makeRelations([{ kind: "Synonym", words: ["laufen"] }]),
	});
}

function makeNounLexicalInfo() {
	return makeLexemeLexicalInfo({
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🏭"],
				ipa: "kraftvɛʁk",
			},
		},
		features: {
			status: "ready",
			value: {
				inherentFeatures: {
					gender: "Neut",
				},
			},
		},
		inflections: {
			status: "ready",
			value: makeNounInflections({
				cells: [
					{
						article: "das",
						case: "Nom",
						form: "Kraftwerk",
						number: "Sing",
					},
					{
						article: "die",
						case: "Nom",
						form: "Kraftwerke",
						number: "Plur",
					},
				],
				gender: "Neut",
			}),
		},
		lemma: "Kraftwerk",
		pos: "NOUN",
	});
}

function makeAdjectiveLexicalInfo() {
	return makeLexemeLexicalInfo({
		core: {
			status: "ready",
			value: {
				emojiDescription: ["✨"],
				ipa: "ʃnɛl",
			},
		},
		features: {
			status: "ready",
			value: {
				inherentFeatures: {},
			},
		},
		lemma: "schnell",
		pos: "ADJ",
	});
}

describe("section generators from LexicalInfo", () => {
	it("renders tags from inherent lexical features", () => {
		const verbSection = generateTagsSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});
		expect(verbSection?.content).toBe("#verb/reflex-yes/separable-yes");

		const adjectiveSection = generateTagsSection({
			lexicalInfo: makeAdjectiveLexicalInfo(),
			targetLang: "German",
		});
		expect(adjectiveSection).toBeNull();
	});

	it("renders relation section and parsed relations from lexical relations", () => {
		const result = generateRelationSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});

		expect(result.relations).toEqual([{ kind: "Synonym", words: ["laufen"] }]);
		expect(result.section?.content).toBe("= [[laufen]]");
	});

	it("renders noun and generic inflections from lexical inflection data", () => {
		const nounResult = generateInflectionSection({
			lexicalInfo: makeNounLexicalInfo(),
			targetLang: "German",
		});
		expect(nounResult.section?.content).toBe(
			"N: das [[Kraftwerk]], die [[Kraftwerke]]",
		);
		expect(nounResult.inflectionCells).toHaveLength(2);

		const genericResult = generateInflectionSection({
			lexicalInfo: makeVerbLexicalInfo(),
			targetLang: "German",
		});
		expect(genericResult.section?.content).toBe("Prasens: [[gehe]], [[gehst]]");
	});
});
