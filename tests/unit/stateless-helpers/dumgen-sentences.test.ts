import { describe, expect, it } from "bun:test";
import {
	alignText,
	locateSentences,
	splitPlainText,
} from "../../../src/stateless-helpers/dumgen-sentences";

describe("splitPlainText", () => {
	it("splits with dumgen's rules: a dialogue tag stays with its quote", () => {
		expect(
			splitPlainText('"Geh!" sagte er. Dann ging sie.\n\nNeuer Absatz.'),
		).toEqual([['"Geh!" sagte er.', "Dann ging sie."], ["Neuer Absatz."]]);
	});

	it("joins a hard-wrapped line and keeps abbreviations inside a Sentence", () => {
		expect(
			splitPlainText("Er kam z. B. spät\nnach Hause. Sie schlief."),
		).toEqual([["Er kam z. B. spät nach Hause.", "Sie schlief."]]);
	});
});

describe("locateSentences", () => {
	it("finds each Sentence's first and last character in the source", () => {
		const source = "  Er kam spät\nnach Hause.   Sie schlief.\n";
		const located = locateSentences(
			source,
			splitPlainText(source).flat(),
		);
		expect(
			located.map(({ start, end }) => source.slice(start, end)),
		).toEqual(["Er kam spät\nnach Hause.", "Sie schlief."]);
	});

	it("matches a decomposed source against dumgen's NFC Sentences", () => {
		const source = "Müde. Grün.";
		const located = locateSentences(source, ["Müde.", "Grün."]);
		expect(
			located.map(({ start, end }) => source.slice(start, end)),
		).toEqual(["Müde.", "Grün."]);
	});
});

describe("alignText", () => {
	it("maps every target unit to its source range, skipping dropped markup", () => {
		const source = "Er *gibt* auf.";
		const alignment = alignText(source, "Er gibt auf.");
		expect(alignment).toBeDefined();
		const word = (from: number, to: number) =>
			source.slice(alignment?.starts[from], alignment?.ends[to - 1]);
		expect(word(3, 7)).toBe("gibt");
		expect(word(8, 11)).toBe("auf");
		expect(alignment && source.slice(alignment.start, alignment.end)).toBe(
			"Er *gibt* auf.",
		);
	});

	it("finds nothing for text the source lacks", () => {
		expect(alignText("abc", "xyz")).toBeUndefined();
	});
});
