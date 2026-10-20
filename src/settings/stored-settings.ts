import { DEFAULT_SETTINGS, type TextEaterSettings } from "../types";

/**
 * Settings the plugin no longer has. The Gemini key and its provider
 * picker went with the Gemini generation, and `generateInflections` with
 * the old lexical generation (#66).
 */
const RETIRED_SETTING_KEYS = [
	"apiProvider",
	"generateInflections",
	"googleApiKey",
] as const;

/**
 * The settings stored data loads as: the defaults, overlaid with what was
 * stored, without the retired keys. Data saved by an older version, with
 * its Gemini key, still loads, and the next save drops those keys.
 */
export function settingsFromStoredData(stored: unknown): TextEaterSettings {
	const loaded: Record<string, unknown> =
		typeof stored === "object" && stored !== null ? { ...stored } : {};
	for (const key of RETIRED_SETTING_KEYS) delete loaded[key];
	return Object.assign({}, DEFAULT_SETTINGS, loaded);
}
