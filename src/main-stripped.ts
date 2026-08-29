/**
 * Stripped-down interface for TextEaterPlugin.
 * Used by settings and utility modules that don't need the full plugin.
 */

import type { Plugin } from "obsidian";
import type { TextEaterSettings } from "./types";

/**
 * Minimal interface representing the TextEater plugin.
 * Contains only the properties needed by settings and file operations.
 */
export default interface TextEaterPluginStripped extends Plugin {
	settings: TextEaterSettings;
	saveSettings(): Promise<void>;
}
