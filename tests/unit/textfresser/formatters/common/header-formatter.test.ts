import { describe, expect, it } from "bun:test";
import { formatHeaderLine } from "../../../../../src/commanders/textfresser/commands/generate/section-formatters/common/header-formatter";

describe("formatHeaderLine", () => {
	it("formats header with emoji sequence from senseEmojis", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["🏭"], ipa: "ˈkoːləˌkraftvɛɐ̯k" },
			"Kohlekraftwerk",
			"German",
		);
		expect(result).toBe(
			"🏭 [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german)",
		);
	});

	it("formats header for a verb (no article)", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["🏃"], ipa: "ˈlaʊ̯fn̩" },
			"laufen",
			"German",
		);
		expect(result).toBe(
			"🏃 [[laufen]], [ˈlaʊ̯fn̩](https://youglish.com/pronounce/laufen/german)",
		);
	});

	it("uses all emojis from multi-emoji description", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["⚡", "💨"], ipa: "ʃnɛl" },
			"schnell",
			"German",
		);
		expect(result).toBe(
			"⚡ 💨 [[schnell]], [ʃnɛl](https://youglish.com/pronounce/schnell/german)",
		);
	});

	it("encodes special characters in youglish URL", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["🏠"], ipa: "ˈʃtʁaːsə" },
			"Straße",
			"German",
		);
		expect(result).toContain("Stra%C3%9Fe");
	});

	it("uses lowercase target language in URL", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["🌍"], ipa: "test" },
			"hello",
			"English",
		);
		expect(result).toContain("/english)");
	});

	it("normalizes vault-path lemma targets to basename", () => {
		const result = formatHeaderLine(
			{ senseEmojis: ["🚗"], ipa: "ˈfaːʁən" },
			"Worter/de/lexem/lemma/f/fah/fahre/Fahren",
			"German",
		);
		expect(result).toBe(
			"🚗 [[Fahren]], [ˈfaːʁən](https://youglish.com/pronounce/Fahren/german)",
		);
	});
});
