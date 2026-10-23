import { Effect } from "effect";
import type { ParsedUserSettings } from "../../../src/settings/parsed-settings";
import type { SettingsService } from "../../../src/settings/settings-service";
import { defaultSettingsForUnitTests } from "./consts";

/** The unit tests' settings, with `overrides`. */
export function testSettings(
	overrides?: Partial<ParsedUserSettings>,
): ParsedUserSettings {
	return { ...defaultSettingsForUnitTests, ...overrides };
}

/** Settings that never change, as the Librarian reads them. */
export function fixedSettings(
	overrides?: Partial<ParsedUserSettings>,
): Pick<SettingsService, "get" | "now"> {
	const settings = testSettings(overrides);
	return { get: Effect.succeed(settings), now: () => settings };
}

/**
 * A plugin's `data.json` in memory: what it holds, and every save. While
 * `failSaves` is set, a save rejects, as a read-only file would.
 */
export function memoryPluginData(stored: unknown = null) {
	const saved: unknown[] = [];
	const data = {
		failSaves: false,
		loadData: () => Promise.resolve(stored),
		saveData: (value: unknown) => {
			if (data.failSaves) return Promise.reject(new Error("EACCES"));
			saved.push(structuredClone(value));
			return Promise.resolve();
		},
		saved,
	};
	return data;
}
