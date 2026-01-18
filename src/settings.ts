import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TextEaterPluginStripped from "./main-stripped";

const FORBIDDEN_DELIMITER_CHARS = [
	"/",
	"\\",
	":",
	"*",
	"?",
	'"',
	"<",
	">",
	"|",
];

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

		// Library settings
		new Setting(containerEl).setName("Library").setHeading();

		new Setting(containerEl)
			.setName("Library root folder")
			.setDesc("The folder containing your library of texts")
			.addText((text) =>
				text
					.setPlaceholder("Library")
					.setValue(this.plugin.settings.libraryRoot)
					.onChange(async (value) => {
						this.plugin.settings.libraryRoot = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max section depth")
			.setDesc(
				"Maximum nesting depth for sections in codexes (1-10). Higher = more nested sections.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(this.plugin.settings.maxSectionDepth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxSectionDepth = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show scrolls in codexes for depth")
			.setDesc(
				"Depth at which scrolls (leaf documents) appear in codexes (0-10). 0 = only top level.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 10, 1)
					.setValue(this.plugin.settings.showScrollsInCodexesForDepth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.showScrollsInCodexesForDepth =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Suffix delimiter")
			.setDesc(
				"1-3 characters used to separate base name from suffix (e.g., '-' or ' - ')",
			)
			.addText((text) => {
				text.setPlaceholder("-").setValue(
					this.plugin.settings.suffixDelimiter,
				);

				text.inputEl.addEventListener("blur", async () => {
					const value = text.getValue();
					// Validate length: 1-3 chars
					if (value.length < 1 || value.length > 5) {
						new Notice("Suffix delimiter must be 1-5 characters");
						text.setValue(this.plugin.settings.suffixDelimiter);
						return;
					}
					// Validate each char against forbidden list
					for (const char of value) {
						if (FORBIDDEN_DELIMITER_CHARS.includes(char)) {
							new Notice(
								`Cannot use "${char}" in delimiter (forbidden character)`,
							);
							text.setValue(this.plugin.settings.suffixDelimiter);
							return;
						}
					}
					// Only save if value changed
					if (value !== this.plugin.settings.suffixDelimiter) {
						this.plugin.settings.suffixDelimiter = value;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName("Show backlinks on scrolls")
			.setDesc("Add go-back links at the top of scroll files")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showScrollBacklinks)
					.onChange(async (value) => {
						this.plugin.settings.showScrollBacklinks = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
