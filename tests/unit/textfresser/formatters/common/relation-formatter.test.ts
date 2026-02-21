import { describe, expect, it } from "bun:test";
import { formatRelationSection } from "../../../../../src/commanders/textfresser/commands/generate/section-formatters/common/relation-formatter";

describe("formatRelationSection", () => {
	it("formats synonyms with = symbol", () => {
		const result = formatRelationSection({
			relations: [{ kind: "Synonym", words: ["Kraftwerk", "Anlage"] }],
		});
		expect(result).toBe("= [[Kraftwerk]], [[Anlage]]");
	});

	it("formats antonyms with ≠ symbol", () => {
		const result = formatRelationSection({
			relations: [{ kind: "Antonym", words: ["Windrad"] }],
		});
		expect(result).toBe("≠ [[Windrad]]");
	});

	it("formats hypernym/hyponym with ⊃/⊂ symbols", () => {
		const result = formatRelationSection({
			relations: [
				{ kind: "Hypernym", words: ["Anlage"] },
				{ kind: "Hyponym", words: ["Braunkohlekraftwerk"] },
			],
		});
		expect(result).toBe(
			"⊃ [[Anlage]]\n⊂ [[Braunkohlekraftwerk]]",
		);
	});

	it("formats meronym/holonym with ∈/∋ symbols", () => {
		const result = formatRelationSection({
			relations: [
				{ kind: "Meronym", words: ["Turbine", "Kessel"] },
				{ kind: "Holonym", words: ["Energieversorgung"] },
			],
		});
		expect(result).toBe(
			"∈ [[Turbine]], [[Kessel]]\n∋ [[Energieversorgung]]",
		);
	});

	it("formats near-synonyms with ≈ symbol", () => {
		const result = formatRelationSection({
			relations: [
				{ kind: "NearSynonym", words: ["Industrieanlage", "Fabrik"] },
			],
		});
		expect(result).toBe("≈ [[Industrieanlage]], [[Fabrik]]");
	});

	it("returns empty string for no relations", () => {
		const result = formatRelationSection({ relations: [] });
		expect(result).toBe("");
	});

	it("normalizes relation words when prompt output contains vault paths", () => {
		const result = formatRelationSection({
			relations: [
				{
					kind: "Synonym",
					words: ["Worter/de/lexem/lemma/f/fah/fahre/Fahren"],
				},
			],
		});
		expect(result).toBe("= [[Fahren]]");
	});
});
