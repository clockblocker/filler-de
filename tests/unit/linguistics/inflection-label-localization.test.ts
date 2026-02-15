import { describe, expect, it } from "bun:test";
import {
	caseValueFromLocalizedLabel,
	getCaseLabelForTargetLanguage,
	getNumberLabelForTargetLanguage,
	numberValueFromLocalizedLabel,
} from "../../../src/linguistics/common/enums/inflection/feature-values";
import { getGermanGenusLabelForTargetLanguage } from "../../../src/linguistics/de/lexem/noun/features";

describe("inflection label localization", () => {
	it("returns German case/number labels", () => {
		expect(getCaseLabelForTargetLanguage("Nominative", "German")).toBe(
			"Nominativ",
		);
		expect(getCaseLabelForTargetLanguage("Accusative", "German")).toBe(
			"Akkusativ",
		);
		expect(getNumberLabelForTargetLanguage("Plural", "German")).toBe(
			"Plural",
		);
		expect(getNumberLabelForTargetLanguage("Singular", "German")).toBe(
			"Singular",
		);
	});

	it("returns English case/number labels", () => {
		expect(getCaseLabelForTargetLanguage("Nominative", "English")).toBe(
			"Nominative",
		);
		expect(getCaseLabelForTargetLanguage("Genitive", "English")).toBe(
			"Genitive",
		);
		expect(getNumberLabelForTargetLanguage("Plural", "English")).toBe(
			"Plural",
		);
		expect(getNumberLabelForTargetLanguage("Singular", "English")).toBe(
			"Singular",
		);
	});

	it("maps localized labels back to canonical enum values", () => {
		expect(caseValueFromLocalizedLabel("Nominativ")).toBe("Nominative");
		expect(caseValueFromLocalizedLabel("Accusative")).toBe("Accusative");
		expect(numberValueFromLocalizedLabel("Plural")).toBe("Plural");
		expect(numberValueFromLocalizedLabel("Singular")).toBe("Singular");
	});

	it("returns localized genus labels for German and English", () => {
		expect(
			getGermanGenusLabelForTargetLanguage("Maskulinum", "German"),
		).toBe("Maskulin");
		expect(
			getGermanGenusLabelForTargetLanguage("Femininum", "German"),
		).toBe("Feminin");
		expect(
			getGermanGenusLabelForTargetLanguage("Neutrum", "German"),
		).toBe("Neutrum");

		expect(
			getGermanGenusLabelForTargetLanguage("Maskulinum", "English"),
		).toBe("Masculine");
		expect(
			getGermanGenusLabelForTargetLanguage("Femininum", "English"),
		).toBe("Feminine");
		expect(
			getGermanGenusLabelForTargetLanguage("Neutrum", "English"),
		).toBe("Neuter");
	});
});
