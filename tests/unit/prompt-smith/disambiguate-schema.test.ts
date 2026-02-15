import { describe, expect, it } from "bun:test";
import { disambiguateSchemas } from "../../../src/prompt-smith/schemas/disambiguate";

const { userInputSchema } = disambiguateSchemas;

describe("Disambiguate schema", () => {
	it("accepts senses with phrasemeKind hints", () => {
		const result = userInputSchema.safeParse({
			context: "Auf jeden Fall komme ich mit.",
			lemma: "auf jeden Fall",
			senses: [
				{
					emojiDescription: ["✅"],
					index: 1,
					phrasemeKind: "DiscourseFormula",
					unitKind: "Phrasem",
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("rejects invalid phrasemeKind values", () => {
		const result = userInputSchema.safeParse({
			context: "Auf jeden Fall komme ich mit.",
			lemma: "auf jeden Fall",
			senses: [
				{
					emojiDescription: ["✅"],
					index: 1,
					phrasemeKind: "UnknownKind",
					unitKind: "Phrasem",
				},
			],
		});

		expect(result.success).toBe(false);
	});
});
