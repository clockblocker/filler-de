import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../../../../src/commanders/textfresser/commands/generate/section-formatters/de/lexem/noun/header-formatter";

describe("noun formatHeaderLine", () => {
	it("formats Maskulinum noun with der article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["☁️"], ipa: "ˈhɪml̩" },
			"Himmel",
			"German",
			"Maskulinum",
		);
		expect(result).toBe(
			"☁️ der [[Himmel]], [ˈhɪml̩](https://youglish.com/pronounce/Himmel/german)",
		);
	});

	it("formats Femininum noun with die article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏦"], ipa: "baŋk" },
			"Bank",
			"German",
			"Femininum",
		);
		expect(result).toContain("die [[Bank]]");
	});

	it("formats Neutrum noun with das article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏠"], ipa: "haʊ̯s" },
			"Haus",
			"German",
			"Neutrum",
		);
		expect(result).toContain("das [[Haus]]");
	});

	it("formats noun header with all emojis in sequence", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["💨", "✨"], ipa: "ˈʃtaʊ̯p" },
			"Staub",
			"German",
			"Maskulinum",
		);
		expect(result).toBe(
			"💨 ✨ der [[Staub]], [ˈʃtaʊ̯p](https://youglish.com/pronounce/Staub/german)",
		);
	});
});
