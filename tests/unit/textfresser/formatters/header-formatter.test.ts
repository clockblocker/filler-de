import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-formatter";

describe("formatHeaderLine", () => {
	it("formats header with emoji derived from emojiDescription[0]", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏭"], ipa: "ˈkoːləˌkraftvɛɐ̯k" },
			"Kohlekraftwerk",
			"German",
		);
		expect(result).toBe(
			"🏭 [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german)",
		);
	});

	it("formats header for a verb (no article)", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏃"], ipa: "ˈlaʊ̯fn̩" },
			"laufen",
			"German",
		);
		expect(result).toBe(
			"🏃 [[laufen]], [ˈlaʊ̯fn̩](https://youglish.com/pronounce/laufen/german)",
		);
	});

	it("uses first emoji from multi-emoji description", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["⚡", "💨"], ipa: "ʃnɛl" },
			"schnell",
			"German",
		);
		expect(result).toBe(
			"⚡ [[schnell]], [ʃnɛl](https://youglish.com/pronounce/schnell/german)",
		);
	});

	it("encodes special characters in youglish URL", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏠"], ipa: "ˈʃtʁaːsə" },
			"Straße",
			"German",
		);
		expect(result).toContain("Stra%C3%9Fe");
	});

	it("uses lowercase target language in URL", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🌍"], ipa: "test" },
			"hello",
			"English",
		);
		expect(result).toContain("/english)");
	});

	it("prepends article for nouns when article is provided", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["☁️"], ipa: "ˈhɪml̩" },
			"Himmel",
			"German",
			"der",
		);
		expect(result).toBe(
			"☁️ der [[Himmel]], [ˈhɪml̩](https://youglish.com/pronounce/Himmel/german)",
		);
	});

	it("does not prepend article when article is undefined", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏃"], ipa: "ˈlaʊ̯fn̩" },
			"laufen",
			"German",
			undefined,
		);
		expect(result).toBe(
			"🏃 [[laufen]], [ˈlaʊ̯fn̩](https://youglish.com/pronounce/laufen/german)",
		);
	});

	it("formats feminine noun with die article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏦"], ipa: "baŋk" },
			"Bank",
			"German",
			"die",
		);
		expect(result).toContain("die [[Bank]]");
	});

	it("formats neuter noun with das article", () => {
		const result = formatHeaderLine(
			{ emojiDescription: ["🏠"], ipa: "haʊ̯s" },
			"Haus",
			"German",
			"das",
		);
		expect(result).toContain("das [[Haus]]");
	});
});
