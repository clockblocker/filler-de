import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../../../../src/commanders/textfresser/commands/generate/section-formatters/de/lexem/noun/header-formatter";

describe("noun formatHeaderLine", () => {
	it("formats Maskulinum noun with der article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["☁️"], ipa: "ˈhɪml̩" },
			"Himmel",
			"German",
			"Masc",
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
			"Fem",
		);
		expect(result).toContain("die [[Bank]]");
	});

	it("formats Neutrum noun with das article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏠"], ipa: "haʊ̯s" },
			"Haus",
			"German",
			"Neut",
		);
		expect(result).toContain("das [[Haus]]");
	});

	it("formats noun header with all emojis in sequence", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["💨", "✨"], ipa: "ˈʃtaʊ̯p" },
			"Staub",
			"German",
			"Masc",
		);
		expect(result).toBe(
			"💨 ✨ der [[Staub]], [ˈʃtaʊ̯p](https://youglish.com/pronounce/Staub/german)",
		);
	});

	it("normalizes vault-path lemma targets to basename", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🚗"], ipa: "ˈfaːʁən" },
			"Worter/de/lexem/lemma/f/fah/fahre/Fahren",
			"German",
			"Masc",
		);
		expect(result).toBe(
			"🚗 der [[Fahren]], [ˈfaːʁən](https://youglish.com/pronounce/Fahren/german)",
		);
	});
});
