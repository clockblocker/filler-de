import { describe, expect, it } from "bun:test";
import { formatInflection } from "../../../../../../../src/commanders/textfresser/commands/generate/section-formatters/de/lexem/noun/inflection-formatter";

describe("formatInflection", () => {
	it("formats cells grouped by case in N/A/G/D order", () => {
		const { formattedSection } = formatInflection({
			cells: [
				{ article: "das", case: "Nominative", form: "Kraftwerk", number: "Singular" },
				{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
				{ article: "das", case: "Accusative", form: "Kraftwerk", number: "Singular" },
				{ article: "die", case: "Accusative", form: "Kraftwerke", number: "Plural" },
				{ article: "des", case: "Genitive", form: "Kraftwerkes", number: "Singular" },
				{ article: "der", case: "Genitive", form: "Kraftwerke", number: "Plural" },
				{ article: "dem", case: "Dative", form: "Kraftwerk", number: "Singular" },
				{ article: "den", case: "Dative", form: "Kraftwerken", number: "Plural" },
			],
			genus: "Neutrum",
		});

		const lines = formattedSection.split("\n");
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe("N: das [[Kraftwerk]], die [[Kraftwerke]]");
		expect(lines[1]).toBe("A: das [[Kraftwerk]], die [[Kraftwerke]]");
		expect(lines[2]).toBe("G: des [[Kraftwerkes]], der [[Kraftwerke]]");
		expect(lines[3]).toBe("D: dem [[Kraftwerk]], den [[Kraftwerken]]");
	});

	it("returns raw cells for propagation", () => {
		const { cells } = formatInflection({
			cells: [
				{ article: "der", case: "Nominative", form: "Mann", number: "Singular" },
				{ article: "die", case: "Nominative", form: "Männer", number: "Plural" },
			],
			genus: "Maskulinum",
		});

		expect(cells).toHaveLength(2);
		expect(cells[0]).toEqual({
			article: "der",
			case: "Nominative",
			form: "Mann",
			number: "Singular",
		});
		expect(cells[1]).toEqual({
			article: "die",
			case: "Nominative",
			form: "Männer",
			number: "Plural",
		});
	});

	it("skips missing cases", () => {
		const { formattedSection } = formatInflection({
			cells: [
				{ article: "das", case: "Nominative", form: "Kind", number: "Singular" },
				{ article: "die", case: "Nominative", form: "Kinder", number: "Plural" },
			],
			genus: "Neutrum",
		});

		expect(formattedSection).toBe("N: das [[Kind]], die [[Kinder]]");
	});

	it("handles all four cases with only singular", () => {
		const { formattedSection } = formatInflection({
			cells: [
				{ article: "der", case: "Nominative", form: "Tisch", number: "Singular" },
				{ article: "den", case: "Accusative", form: "Tisch", number: "Singular" },
				{ article: "des", case: "Genitive", form: "Tisches", number: "Singular" },
				{ article: "dem", case: "Dative", form: "Tisch", number: "Singular" },
			],
			genus: "Maskulinum",
		});

		const lines = formattedSection.split("\n");
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe("N: der [[Tisch]]");
		expect(lines[1]).toBe("A: den [[Tisch]]");
		expect(lines[2]).toBe("G: des [[Tisches]]");
		expect(lines[3]).toBe("D: dem [[Tisch]]");
	});

	it("handles empty cells", () => {
		const { formattedSection, cells } = formatInflection({
			cells: [],
			genus: "Neutrum",
		});
		expect(formattedSection).toBe("");
		expect(cells).toHaveLength(0);
	});

	it("normalizes path-like form targets to basename", () => {
		const { formattedSection, cells } = formatInflection({
			cells: [
				{
					article: "die",
					case: "Nominative",
					form: "Worter/de/lexem/lemma/f/fah/fahre/Fahren",
					number: "Plural",
				},
			],
			genus: "Neutrum",
		});

		expect(formattedSection).toBe("N: die [[Fahren]]");
		expect(cells[0]?.form).toBe("Fahren");
	});
});
