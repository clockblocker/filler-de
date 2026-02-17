import { describe, expect, it } from "bun:test";
import { lexemEnrichmentSchemas } from "../../../src/prompt-smith/schemas/lexem-enrichment";
import { nounEnrichmentSchemas } from "../../../src/prompt-smith/schemas/noun-enrichment";
import { phrasemEnrichmentSchemas } from "../../../src/prompt-smith/schemas/phrasem-enrichment";

describe("Enrichment schemas", () => {
	it("accepts Lexem enrichment input/output", () => {
		const inResult = lexemEnrichmentSchemas.userInputSchema.safeParse({
			context: "Das Haus steht am Ende der Straße.",
			pos: "Noun",
			word: "Haus",
		});
		expect(inResult.success).toBe(true);

		const outResult = lexemEnrichmentSchemas.agentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			ipa: "haʊ̯s",
			senseGloss: "dwelling building",
		});
		expect(outResult.success).toBe(true);
	});

	it("accepts Noun enrichment input/output", () => {
		const inResult = nounEnrichmentSchemas.userInputSchema.safeParse({
			context: "Das Haus steht am Ende der Straße.",
			word: "Haus",
		});
		expect(inResult.success).toBe(true);

		const outResult = nounEnrichmentSchemas.agentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			nounClass: "Common",
		});
		expect(outResult.success).toBe(true);
	});

	it("accepts Phrasem enrichment input/output", () => {
		const inResult = phrasemEnrichmentSchemas.userInputSchema.safeParse({
			context: "Das machen wir auf jeden Fall morgen.",
			kind: "DiscourseFormula",
			word: "auf jeden Fall",
		});
		expect(inResult.success).toBe(true);

		const outResult = phrasemEnrichmentSchemas.agentOutputSchema.safeParse({
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			senseGloss: "definitely / certainly",
		});
		expect(outResult.success).toBe(true);
	});
});
