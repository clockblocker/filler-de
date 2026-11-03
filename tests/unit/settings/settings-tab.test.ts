import { describe, expect, it } from "bun:test";
import { App, PluginSettingTab } from "obsidian";
import type TextEaterPluginStripped from "../../../src/main-stripped";
import type { SettingsPatch } from "../../../src/settings/settings-changes";
import { SettingsTab } from "../../../src/settings/settings-tab";

describe("SettingsTab", () => {
	it("leaves Obsidian's bare update(), which addSettingTab calls, to the base tab", () => {
		const patches: unknown[] = [];
		const plugin = {
			settings: undefined,
			settingsProblem: undefined,
			updateSettings: (patch: SettingsPatch) => {
				patches.push(patch);
				return Promise.resolve();
			},
		} as unknown as TextEaterPluginStripped;
		const tab = new SettingsTab({} as App, plugin);

		// Obsidian 1.15's `app.setting.addSettingTab(tab)` does this.
		tab.update();

		expect(patches).toHaveLength(0);
		expect(tab.update).toBe(PluginSettingTab.prototype.update);
	});
});
