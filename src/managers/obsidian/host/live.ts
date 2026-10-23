/**
 * The host over Obsidian itself. Apart from `index.ts`, so that importing
 * the services does not load Obsidian's `Modal`.
 */
import type { Plugin } from "obsidian";
import { openConfirmModal } from "./confirm-modal";
import { ObsidianHostOver } from "./index";
import { obsidianNotices } from "./notices";

/** The host over Obsidian's plugin. */
export const ObsidianHostLive = (plugin: Plugin) =>
	ObsidianHostOver({
		confirm: openConfirmModal(plugin.app),
		notices: obsidianNotices,
		plugin,
		workspace: plugin.app.workspace,
	});
