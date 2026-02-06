import { describe, expect, it } from "bun:test";
import { formatInflectionSection } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/inflection-formatter";

describe("formatInflectionSection", () => {
	it("formats rows as label: forms lines", () => {
		const result = formatInflectionSection({
			rows: [
				{ forms: "schnell, schneller, am schnellsten", label: "Komparativ" },
				{ forms: "schnell, schnelle, schnelles", label: "Deklination" },
			],
		});
		expect(result).toBe(
			"Komparativ: schnell, schneller, am schnellsten\nDeklination: schnell, schnelle, schnelles",
		);
	});

	it("handles single row", () => {
		const result = formatInflectionSection({
			rows: [{ forms: "laufe, läufst, läuft", label: "Präsens" }],
		});
		expect(result).toBe("Präsens: laufe, läufst, läuft");
	});

	it("handles empty rows", () => {
		const result = formatInflectionSection({ rows: [] });
		expect(result).toBe("");
	});
});
