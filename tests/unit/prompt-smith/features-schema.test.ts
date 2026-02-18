import { describe, expect, it } from "bun:test";
import { featuresAdjectiveSchemas } from "../../../src/prompt-smith/schemas/features-adjective";
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

		it("accepts structured verb output", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				conjugation: "Rregular",
				valency: {
					reflexivity: "NonReflexive",
					separability: "Separable",
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts structured verb output with null governedPreposition", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				conjugation: "Rregular",
				valency: {
					governedPreposition: null,
					reflexivity: "NonReflexive",
					separability: "Separable",
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts structured adjective output", () => {
			const result = featuresAdjectiveSchemas.agentOutputSchema.safeParse({
				classification: "Qualitative",
				distribution: "AttributiveAndPredicative",
				gradability: "Gradable",
				valency: {
					governedPattern: "Prepositional",
					governedPreposition: "auf",
				},
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

		it("rejects unknown separability", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				conjugation: "Rregular",
				valency: {
					reflexivity: "NonReflexive",
					separability: "Both",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects unknown conjugation", () => {
			const result = featuresVerbSchemas.agentOutputSchema.safeParse({
				conjugation: "Regular",
				valency: {
					reflexivity: "NonReflexive",
					separability: "Separable",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects adjective prepositional valency without preposition", () => {
			const result = featuresAdjectiveSchemas.agentOutputSchema.safeParse({
				classification: "Qualitative",
				distribution: "AttributiveAndPredicative",
				gradability: "Gradable",
				valency: {
					governedPattern: "Prepositional",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects adjective prepositional valency with null preposition", () => {
			const result = featuresAdjectiveSchemas.agentOutputSchema.safeParse({
				classification: "Qualitative",
				distribution: "AttributiveAndPredicative",
				gradability: "Gradable",
				valency: {
					governedPattern: "Prepositional",
					governedPreposition: null,
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects adjective extra preposition when not prepositional", () => {
			const result = featuresAdjectiveSchemas.agentOutputSchema.safeParse({
				classification: "Qualitative",
				distribution: "AttributiveAndPredicative",
				gradability: "Gradable",
				valency: {
					governedPattern: "None",
					governedPreposition: "auf",
				},
			});
			expect(result.success).toBe(false);
		});
	});
});
