import { describe, expect, it } from "bun:test";
import { formatInflection } from "../../../../../../../src/commanders/textfresser/commands/generate/section-formatters/de/lexem/noun/inflection-formatter";
import { makeNounInflections } from "../../../../helpers/native-fixtures";

describe("formatInflection", () => {
	it("formats cells grouped by case in N/A/G/D order", () => {
		const { formattedSection } = formatInflection(makeNounInflections({
			cells: [
				{ article: "das", case: "Nom", form: "Kraftwerk", number: "Sing" },
				{ article: "die", case: "Nom", form: "Kraftwerke", number: "Plur" },
				{ article: "das", case: "Acc", form: "Kraftwerk", number: "Sing" },
				{ article: "die", case: "Acc", form: "Kraftwerke", number: "Plur" },
				{ article: "des", case: "Gen", form: "Kraftwerkes", number: "Sing" },
				{ article: "der", case: "Gen", form: "Kraftwerke", number: "Plur" },
				{ article: "dem", case: "Dat", form: "Kraftwerk", number: "Sing" },
				{ article: "den", case: "Dat", form: "Kraftwerken", number: "Plur" },
			],
			gender: "Neut",
		}));

		const lines = formattedSection.split("\n");
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe("N: das [[Kraftwerk]], die [[Kraftwerke]]");
		expect(lines[1]).toBe("A: das [[Kraftwerk]], die [[Kraftwerke]]");
		expect(lines[2]).toBe("G: des [[Kraftwerkes]], der [[Kraftwerke]]");
		expect(lines[3]).toBe("D: dem [[Kraftwerk]], den [[Kraftwerken]]");
	});

	it("returns raw cells for propagation", () => {
		const { cells } = formatInflection(makeNounInflections({
			cells: [
				{ article: "der", case: "Nom", form: "Mann", number: "Sing" },
				{ article: "die", case: "Nom", form: "Männer", number: "Plur" },
			],
			gender: "Masc",
		}));

		expect(cells).toHaveLength(2);
		expect(cells[0]).toEqual({
			article: "der",
			case: "Nom",
			form: "Mann",
			number: "Sing",
		});
		expect(cells[1]).toEqual({
			article: "die",
			case: "Nom",
			form: "Männer",
			number: "Plur",
		});
	});

	it("skips missing cases", () => {
		const { formattedSection } = formatInflection(makeNounInflections({
			cells: [
				{ article: "das", case: "Nom", form: "Kind", number: "Sing" },
				{ article: "die", case: "Nom", form: "Kinder", number: "Plur" },
			],
			gender: "Neut",
		}));

		expect(formattedSection).toBe("N: das [[Kind]], die [[Kinder]]");
	});

	it("handles all four cases with only singular", () => {
		const { formattedSection } = formatInflection(makeNounInflections({
			cells: [
				{ article: "der", case: "Nom", form: "Tisch", number: "Sing" },
				{ article: "den", case: "Acc", form: "Tisch", number: "Sing" },
				{ article: "des", case: "Gen", form: "Tisches", number: "Sing" },
				{ article: "dem", case: "Dat", form: "Tisch", number: "Sing" },
			],
			gender: "Masc",
		}));

		const lines = formattedSection.split("\n");
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe("N: der [[Tisch]]");
		expect(lines[1]).toBe("A: den [[Tisch]]");
		expect(lines[2]).toBe("G: des [[Tisches]]");
		expect(lines[3]).toBe("D: dem [[Tisch]]");
	});

	it("handles empty cells", () => {
		const { formattedSection, cells } = formatInflection(makeNounInflections({
			cells: [],
			gender: "Neut",
		}));
		expect(formattedSection).toBe("");
		expect(cells).toHaveLength(0);
	});

	it("normalizes path-like form targets to basename", () => {
		const { formattedSection, cells } = formatInflection(makeNounInflections({
			cells: [
				{
					article: "die",
					case: "Nom",
					form: "Worter/de/lexem/lemma/f/fah/fahre/Fahren",
					number: "Plur",
				},
			],
			gender: "Neut",
		}));

		expect(formattedSection).toBe("N: die [[Fahren]]");
		expect(cells[0]?.form).toBe("Fahren");
	});
});
