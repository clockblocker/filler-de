/**
 * Stripped-down interface for TextEaterPlugin.
 * Used by settings and utility modules that don't need the full plugin.
 */

import type { Plugin } from "obsidian";
import type { SettingsPatch } from "./settings/settings-changes";
import type { TextEaterSettings } from "./types";

/**
 * Minimal interface representing the TextEater plugin.
 * Contains only the properties needed by the settings tab.
 */
export default interface TextEaterPluginStripped extends Plugin {
	/** The settings in effect; undefined while they load, and after unload. */
	readonly settings: TextEaterSettings | undefined;
	/** Applies `patch` to the settings and stores them; resolves once done. */
	updateSettings(patch: SettingsPatch): Promise<void>;
}
