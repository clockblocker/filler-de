import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-formatter";

describe("formatHeaderLine", () => {
	it("formats a noun header with genus", () => {
		const result = formatHeaderLine(
			{ emoji: "🏭", genus: "Neutrum", ipa: "ˈkoːləˌkraftvɛɐ̯k" },
			"Kohlekraftwerk",
			"German",
		);
		expect(result).toBe(
			"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)",
		);
	});

	it("formats without article when genus is null", () => {
		const result = formatHeaderLine(
			{ emoji: "🏃", genus: null, ipa: "ˈlaʊ̯fn̩" },
			"laufen",
			"German",
		);
		expect(result).toBe(
			"🏃 [[laufen]], [ˈlaʊ̯fn̩ ♫](https://youglish.com/pronounce/laufen/german)",
		);
	});

	it("formats without article when genus is undefined", () => {
		const result = formatHeaderLine(
			{ emoji: "⚡", ipa: "ʃnɛl" },
			"schnell",
			"German",
		);
		expect(result).toBe(
			"⚡ [[schnell]], [ʃnɛl ♫](https://youglish.com/pronounce/schnell/german)",
		);
	});

	it("encodes special characters in youglish URL", () => {
		const result = formatHeaderLine(
			{ emoji: "🏠", genus: "Femininum", ipa: "ˈʃtʁaːsə" },
			"Straße",
			"German",
		);
		expect(result).toContain("Stra%C3%9Fe");
	});

	it("derives correct article from each genus", () => {
		const maskulinum = formatHeaderLine(
			{ emoji: "🐕", genus: "Maskulinum", ipa: "hʊnt" },
			"Hund",
			"German",
		);
		expect(maskulinum).toContain("der [[Hund]]");

		const femininum = formatHeaderLine(
			{ emoji: "🐈", genus: "Femininum", ipa: "ˈkatsə" },
			"Katze",
			"German",
		);
		expect(femininum).toContain("die [[Katze]]");

		const neutrum = formatHeaderLine(
			{ emoji: "🏠", genus: "Neutrum", ipa: "haʊ̯s" },
			"Haus",
			"German",
		);
		expect(neutrum).toContain("das [[Haus]]");
	});

	it("uses lowercase target language in URL", () => {
		const result = formatHeaderLine(
			{ emoji: "🌍", genus: null, ipa: "test" },
			"hello",
			"English",
		);
		expect(result).toContain("/english)");
	});
});
