import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-formatter";

describe("formatHeaderLine", () => {
	it("formats a noun header with article", () => {
		const result = formatHeaderLine(
			{ article: "das", emoji: "🏭", ipa: "ˈkoːləˌkraftvɛɐ̯k" },
			"Kohlekraftwerk",
			"German",
		);
		expect(result).toBe(
			"🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)",
		);
	});

	it("formats without article when null", () => {
		const result = formatHeaderLine(
			{ article: null, emoji: "🏃", ipa: "ˈlaʊ̯fn̩" },
			"laufen",
			"German",
		);
		expect(result).toBe(
			"🏃 [[laufen]], [ˈlaʊ̯fn̩ ♫](https://youglish.com/pronounce/laufen/german)",
		);
	});

	it("formats without article when undefined", () => {
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
			{ article: "die", emoji: "🏠", ipa: "ˈʃtʁaːsə" },
			"Straße",
			"German",
		);
		expect(result).toContain("Stra%C3%9Fe");
	});

	it("uses lowercase target language in URL", () => {
		const result = formatHeaderLine(
			{ article: null, emoji: "🌍", ipa: "test" },
			"hello",
			"English",
		);
		expect(result).toContain("/english)");
	});
});
