import { describe, expect, it } from "bun:test";
import { featuresNounSchemas } from "../../../src/prompt-smith/schemas/features-noun";
import { featuresVerbSchemas } from "../../../src/prompt-smith/schemas/features-verb";

describe("Features schema", () => {
	describe("userInputSchema", () => {
		it("accepts valid input", () => {
			const result = featuresNounSchemas.userInputSchema.safeParse({
				context: "Der Himmel ist blau.",
				word: "Himmel",
			});
			expect(result.success).toBe(true);
		});

		it("rejects input missing word", () => {
			const result = featuresVerbSchemas.userInputSchema.safeParse({
				context: "some context",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("agentOutputSchema", () => {
		it("accepts single tag", () => {
			const result = featuresNounSchemas.agentOutputSchema.safeParse({
				tags: ["maskulin"],
			});
			expect(result.success).toBe(true);
		});

		it("accepts multiple tags", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				tags: ["transitiv", "trennbar"],
			});
			expect(result.success).toBe(true);
		});

		it("accepts up to 5 tags", () => {
			const result = featuresNounSchemas.agentOutputSchema.safeParse({
				tags: ["a", "b", "c", "d", "e"],
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty tags array", () => {
			const result = featuresNounSchemas.agentOutputSchema.safeParse({
				tags: [],
			});
			expect(result.success).toBe(false);
		});

		it("rejects more than 5 tags", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				tags: ["a", "b", "c", "d", "e", "f"],
			});
			expect(result.success).toBe(false);
		});

		it("rejects empty string tag", () => {
			const result = featuresNounSchemas.agentOutputSchema.safeParse({
				tags: [""],
			});
			expect(result.success).toBe(false);
		});

		it("rejects tag exceeding 30 chars", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				tags: ["a".repeat(31)],
			});
			expect(result.success).toBe(false);
		});
	});
});
