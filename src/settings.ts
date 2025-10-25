import { type App, PluginSettingTab, Setting } from "obsidian";
import type TextEaterPluginStripped from "./main-stripped";

export class SettingsTab extends PluginSettingTab {
	plugin: TextEaterPluginStripped;

	constructor(app: App, plugin: TextEaterPluginStripped) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("API key").setHeading();

		new Setting(containerEl)
			.setName("Gemini API key")
			.setDesc("Enter your Gemini API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.googleApiKey)
					.onChange(async (value) => {
						this.plugin.settings.googleApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("API provider")
			.setDesc("Choose your API provider")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("google", "Google")
					.setValue(this.plugin.settings.apiProvider)
					.onChange(async (value: "google") => {
						this.plugin.settings.apiProvider = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
