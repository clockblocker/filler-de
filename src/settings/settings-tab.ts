import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TextEaterPluginStripped from "../main-stripped";
import { ACTION_DEFINITIONS } from "../managers/overlay-manager/action-definitions/definitions";
import {
	type KnownLanguage,
	KnownLanguageSchema,
	ReprForLanguage,
	type SelectionActionPlacement as SelectionActionPlacementType,
	type TargetLanguage,
	TargetLanguageSchema,
} from "../types";
import { LOCALES, type SettingsLocale } from "./locales";

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

	private getLocale(): SettingsLocale {
		return LOCALES[this.plugin.settings.languages.known];
	}

	display(): void {
		const { containerEl } = this;
		const t = this.getLocale();

		containerEl.empty();

		new Setting(containerEl).setName(t.apiKeyHeading).setHeading();

		new Setting(containerEl)
			.setName(t.geminiApiKey)
			.setDesc(t.geminiApiKeyDesc)
			.addText((text) =>
				text
					.setPlaceholder(t.apiKeyPlaceholder)
					.setValue(this.plugin.settings.googleApiKey)
					.onChange(async (value) => {
						this.plugin.settings.googleApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.apiProvider)
			.setDesc(t.apiProviderDesc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("google", "Google")
					.setValue(this.plugin.settings.apiProvider)
					.onChange(async (value: "google") => {
						this.plugin.settings.apiProvider = value;
						await this.plugin.saveSettings();
					});
			});

		// Languages settings
		new Setting(containerEl).setName(t.languagesHeading).setHeading();

		new Setting(containerEl)
			.setName(t.knownLanguage)
			.setDesc(t.knownLanguageDesc)
			.addDropdown((dropdown) => {
				for (const lang of KnownLanguageSchema.options) {
					dropdown.addOption(lang, ReprForLanguage[lang]);
				}
				dropdown
					.setValue(this.plugin.settings.languages.known)
					.onChange(async (value: KnownLanguage) => {
						this.plugin.settings.languages = {
							...this.plugin.settings.languages,
							known: value,
						};
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t.targetLanguage)
			.setDesc(t.targetLanguageDesc)
			.addDropdown((dropdown) => {
				for (const lang of TargetLanguageSchema.options) {
					dropdown.addOption(lang, ReprForLanguage[lang]);
				}
				dropdown
					.setValue(this.plugin.settings.languages.target)
					.onChange(async (value: TargetLanguage) => {
						this.plugin.settings.languages = {
							...this.plugin.settings.languages,
							target: value,
						};
						await this.plugin.saveSettings();
					});
			});

		// Actions settings (moved here, after Languages)
		new Setting(containerEl).setName(t.actionsHeading).setHeading();

		for (const def of Object.values(ACTION_DEFINITIONS)) {
			// Skip if no settingKey or only 1 placement option
			if (!def.settingKey || def.selectablePlacements.length <= 1)
				continue;

			const actionLabel = t.actionLabels[def.id] ?? def.label;
			new Setting(containerEl)
				.setName(actionLabel)
				.setDesc(t.actionPlacementDesc(actionLabel))
				.addDropdown((dropdown) => {
					for (const placement of def.selectablePlacements) {
						dropdown.addOption(
							placement,
							t.placementText[
								placement as SelectionActionPlacementType
							],
						);
					}
					dropdown
						.setValue(
							this.plugin.settings[
								def.settingKey as keyof typeof this.plugin.settings
							] as string,
						)
						.onChange(
							async (value: SelectionActionPlacementType) => {
								// Type assertion needed: settingKey is dynamic but we know it's a placement key
								// biome-ignore lint/suspicious/noExplicitAny: Dynamic settings key access
								(this.plugin.settings as any)[
									def.settingKey as string
								] = value;
								await this.plugin.saveSettings();
							},
						);
				});
		}

		new Setting(containerEl)
			.setName(t.navButtonsPosition)
			.setDesc(t.navButtonsPositionDesc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("left", t.navButtonsLeft)
					.addOption("right", t.navButtonsRight)
					.setValue(this.plugin.settings.navButtonsPosition)
					.onChange(async (value: "left" | "right") => {
						this.plugin.settings.navButtonsPosition = value;
						await this.plugin.saveSettings();
					});
			});

		// Library settings
		new Setting(containerEl).setName(t.libraryHeading).setHeading();

		new Setting(containerEl)
			.setName(t.libraryRoot)
			.setDesc(t.libraryRootDesc)
			.addText((text) =>
				text
					.setPlaceholder(t.libraryRootPlaceholder)
					.setValue(this.plugin.settings.libraryRoot)
					.onChange(async (value) => {
						this.plugin.settings.libraryRoot = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.maxSectionDepth)
			.setDesc(t.maxSectionDepthDesc)
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
			.setName(t.showScrollsDepth)
			.setDesc(t.showScrollsDepthDesc)
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
			.setName(t.suffixDelimiter)
			.setDesc(t.suffixDelimiterDesc)
			.addText((text) => {
				text.setPlaceholder(t.suffixDelimiterPlaceholder).setValue(
					this.plugin.settings.suffixDelimiter.symbol,
				);

				text.inputEl.addEventListener("blur", async () => {
					const value = text.getValue().trim();
					// Validate length: 1-3 chars
					if (value.length < 1 || value.length > 3) {
						new Notice(t.delimiterLengthError);
						text.setValue(
							this.plugin.settings.suffixDelimiter.symbol,
						);
						return;
					}
					// Validate no spaces
					if (value.includes(" ")) {
						new Notice(t.delimiterSpacesError);
						text.setValue(
							this.plugin.settings.suffixDelimiter.symbol,
						);
						return;
					}
					// Validate each char against forbidden list
					for (const char of value) {
						if (FORBIDDEN_DELIMITER_CHARS.includes(char)) {
							new Notice(t.delimiterForbiddenCharError(char));
							text.setValue(
								this.plugin.settings.suffixDelimiter.symbol,
							);
							return;
						}
					}
					// Only save if value changed
					if (value !== this.plugin.settings.suffixDelimiter.symbol) {
						this.plugin.settings.suffixDelimiter = {
							...this.plugin.settings.suffixDelimiter,
							symbol: value,
						};
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName(t.wrapDelimiter)
			.setDesc(t.wrapDelimiterDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.suffixDelimiter.padded)
					.onChange(async (value) => {
						this.plugin.settings.suffixDelimiter = {
							...this.plugin.settings.suffixDelimiter,
							padded: value,
						};
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.showBacklinks)
			.setDesc(t.showBacklinksDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showScrollBacklinks)
					.onChange(async (value) => {
						this.plugin.settings.showScrollBacklinks = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.hideMetadata)
			.setDesc(t.hideMetadataDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideMetadata)
					.onChange(async (value) => {
						this.plugin.settings.hideMetadata = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
