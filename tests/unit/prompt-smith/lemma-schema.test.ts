import { describe, expect, it } from "bun:test";
import { lemmaSchemas } from "../../../src/prompt-smith/schemas/lemma";

const { agentOutputSchema } = lemmaSchemas;

describe("Lemma schema", () => {
	it("accepts Phrasem output with phrasemeKind", () => {
		const result = agentOutputSchema.safeParse({
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			phrasemeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("rejects Phrasem output without phrasemeKind", () => {
		const result = agentOutputSchema.safeParse({
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("accepts Lexem output without phrasemeKind", () => {
		const result = agentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			ipa: "haʊ̯s",
			lemma: "Haus",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			pos: "Noun",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});
});
