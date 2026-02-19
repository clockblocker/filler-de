import { App, PluginSettingTab, Setting } from 'obsidian';
import TextEaterPlugin from './main';

export class SettingsTab extends PluginSettingTab {
	plugin: TextEaterPlugin;

	constructor(app: App, plugin: TextEaterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('API key').setHeading();

		new Setting(containerEl)
			.setName('Gemini API key')
			.setDesc('Enter your Gemini API key')
			.addText((text) =>
				text
					.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.googleApiKey)
					.onChange(async (value) => {
						this.plugin.settings.googleApiKey = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
