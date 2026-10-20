import { describe, expect, it } from "bun:test";
import {
	holdsRetiredSettings,
	settingsFromStoredData,
} from "../../../src/settings/stored-settings";
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

	it("tells data holding a retired key apart from current data", () => {
		expect(holdsRetiredSettings({ googleApiKey: "" })).toBe(true);
		expect(holdsRetiredSettings({ generateInflections: true })).toBe(true);
		expect(holdsRetiredSettings(DEFAULT_SETTINGS)).toBe(false);
		expect(holdsRetiredSettings(null)).toBe(false);
	});

	it("falls back to the defaults when nothing is stored", () => {
		expect(settingsFromStoredData(null)).toEqual(DEFAULT_SETTINGS);
		expect(settingsFromStoredData(undefined)).toEqual(DEFAULT_SETTINGS);
	});
});
