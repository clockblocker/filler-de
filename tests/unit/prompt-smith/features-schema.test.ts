import { describe, expect, it } from "bun:test";
import { featuresSchemas } from "../../../src/prompt-smith/schemas/features";

const { userInputSchema, agentOutputSchema } = featuresSchemas;

describe("Features schema", () => {
	describe("userInputSchema", () => {
		it("accepts valid input", () => {
			const result = userInputSchema.safeParse({
				context: "Der Himmel ist blau.",
				pos: "Noun",
				word: "Himmel",
			});
			expect(result.success).toBe(true);
		});

		it("rejects input missing word", () => {
			const result = userInputSchema.safeParse({
				context: "some context",
				pos: "Noun",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("agentOutputSchema", () => {
		it("accepts single tag", () => {
			const result = agentOutputSchema.safeParse({
				tags: ["maskulin"],
			});
			expect(result.success).toBe(true);
		});

		it("accepts multiple tags", () => {
			const result = agentOutputSchema.safeParse({
				tags: ["transitiv", "trennbar"],
			});
			expect(result.success).toBe(true);
		});

		it("accepts up to 5 tags", () => {
			const result = agentOutputSchema.safeParse({
				tags: ["a", "b", "c", "d", "e"],
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty tags array", () => {
			const result = agentOutputSchema.safeParse({
				tags: [],
			});
			expect(result.success).toBe(false);
		});

		it("rejects more than 5 tags", () => {
			const result = agentOutputSchema.safeParse({
				tags: ["a", "b", "c", "d", "e", "f"],
			});
			expect(result.success).toBe(false);
		});

		it("rejects empty string tag", () => {
			const result = agentOutputSchema.safeParse({
				tags: [""],
			});
			expect(result.success).toBe(false);
		});

		it("rejects tag exceeding 30 chars", () => {
			const result = agentOutputSchema.safeParse({
				tags: ["a".repeat(31)],
			});
			expect(result.success).toBe(false);
		});
	});
});
