import { describe, expect, it } from "bun:test";
import { morphemSchemas } from "../../../src/prompt-smith/schemas/morphem";

describe("Morphem schema", () => {
	it("accepts optional derived_from and compounded_from", () => {
		const result = morphemSchemas.agentOutputSchema.safeParse({
			compounded_from: ["Arbeit", "Platz"],
			derived_from: {
				derivation_type: "suffix_derivation",
				lemma: "frei",
			},
			morphemes: [
				{ kind: "Root", lemma: "Arbeit", surf: "arbeit" },
				{ kind: "Interfix", surf: "s" },
				{ kind: "Root", lemma: "Platz", surf: "platz" },
			],
		});

		expect(result.success).toBe(true);
	});

	it("accepts output without morphology fields", () => {
		const result = morphemSchemas.agentOutputSchema.safeParse({
			morphemes: [{ kind: "Root", lemma: "Hand", surf: "hand" }],
		});

		expect(result.success).toBe(true);
	});

	it("rejects invalid derived_from cardinality", () => {
		const result = morphemSchemas.agentOutputSchema.safeParse({
			derived_from: [
				{ derivation_type: "prefix_derivation", lemma: "passen" },
				{ derivation_type: "prefix_derivation", lemma: "stehen" },
			],
			morphemes: [
				{ kind: "Prefix", separability: "Separable", surf: "auf" },
				{ kind: "Root", lemma: "passen", surf: "passen" },
			],
		});

		expect(result.success).toBe(false);
	});
});
