/**
 * Stripped-down interface for TextEaterPlugin.
 * Used by settings and legacy code that doesn't need the full plugin.
 */
import type { Plugin } from "obsidian";
import type { OpenedFileService } from "./managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import type { TextEaterSettings } from "./types";

/**
 * Minimal interface representing the TextEater plugin.
 * Contains only the properties needed by settings and legacy file operations.
 */
export default interface TextEaterPluginStripped extends Plugin {
	settings: TextEaterSettings;
	openedFileService?: OpenedFileService;
	saveSettings(): Promise<void>;
}
