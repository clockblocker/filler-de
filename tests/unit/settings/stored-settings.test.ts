import { describe, expect, it } from "bun:test";
import { settingsFromStoredData } from "../../../src/settings/stored-settings";
import { DEFAULT_SETTINGS } from "../../../src/types";

describe("settingsFromStoredData", () => {
	it("loads data saved with the Gemini key, keeping everything else", () => {
		const settings = settingsFromStoredData({
			apiProvider: "google",
			generateInflections: false,
			googleApiKey: "gemini-key",
			languages: { known: "English", target: "German" },
			openaiApiKey: "openai-key",
			typesafeApiKey: "typesafe-key",
		});

		expect(settings).toEqual({
			...DEFAULT_SETTINGS,
			languages: { known: "English", target: "German" },
			openaiApiKey: "openai-key",
			typesafeApiKey: "typesafe-key",
		});
		expect("googleApiKey" in settings).toBe(false);
		expect("apiProvider" in settings).toBe(false);
		expect("generateInflections" in settings).toBe(false);
	});

	it("falls back to the defaults when nothing is stored", () => {
		expect(settingsFromStoredData(null)).toEqual(DEFAULT_SETTINGS);
		expect(settingsFromStoredData(undefined)).toEqual(DEFAULT_SETTINGS);
	});
});
