import { describe, expect, it } from "bun:test";
import { lexemEnrichmentSchemas } from "../../../src/prompt-smith/schemas/lexem-enrichment";
import { phrasemEnrichmentSchemas } from "../../../src/prompt-smith/schemas/phrasem-enrichment";

describe("Enrichment schemas", () => {
	it("accepts Lexem enrichment input/output", () => {
		const inResult = lexemEnrichmentSchemas.userInputSchema.safeParse({
			context: "Das Haus steht am Ende der Straße.",
			target: {
				lemma: "Haus",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
		});
		expect(inResult.success).toBe(true);

		const outResult = lexemEnrichmentSchemas.agentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			posLikeKind: "Noun",
		});
		expect(outResult.success).toBe(true);
	});

	it("accepts Phrasem enrichment input/output", () => {
		const inResult = phrasemEnrichmentSchemas.userInputSchema.safeParse({
			context: "Das machen wir auf jeden Fall morgen.",
			target: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		});
		expect(inResult.success).toBe(true);

		const outResult = phrasemEnrichmentSchemas.agentOutputSchema.safeParse({
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
		});
		expect(outResult.success).toBe(true);
	});
});
