import { describe, expect, it } from "bun:test";
import { lemmaSchemas } from "../../../src/prompt-smith/schemas/lemma";

const { agentOutputSchema } = lemmaSchemas;

describe("Lemma schema", () => {
	it("accepts Phrasem output with posLikeKind", () => {
		const result = agentOutputSchema.safeParse({
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("rejects Phrasem output without posLikeKind", () => {
		const result = agentOutputSchema.safeParse({
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("accepts Lexem output with POS in posLikeKind", () => {
		const result = agentOutputSchema.safeParse({
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});
});
