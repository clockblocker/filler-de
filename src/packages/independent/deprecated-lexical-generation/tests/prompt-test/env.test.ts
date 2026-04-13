import { describe, expect, it } from "bun:test";
import { getGeminiApiKey, hasGeminiApiKey } from "./env";

describe("prompt-test env", () => {
	it("reads GEMINI_API_KEY from environment variables", () => {
		expect(
			getGeminiApiKey({
				GEMINI_API_KEY: "secret-key",
			}),
		).toBe("secret-key");
	});

	it("treats blank GEMINI_API_KEY as missing", () => {
		expect(hasGeminiApiKey({ GEMINI_API_KEY: "   " })).toBe(false);
		expect(() => getGeminiApiKey({ GEMINI_API_KEY: "   " })).toThrow(
			"Missing GEMINI_API_KEY environment variable",
		);
	});
});
