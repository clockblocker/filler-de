import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TextEaterPluginStripped from "../main-stripped";
import { ACTION_DEFINITIONS } from "../managers/overlay-manager/action-definitions/definitions";
import {
	KnownLanguageSchema,
	ReprForLanguage,
	SelectionActionPlacementSchema,
	type SelectionActionPlacement as SelectionActionPlacementType,
	TargetLanguageSchema,
} from "../types";
import { LOCALES } from "./locales";
import type { SettingsPatch } from "./settings-changes";

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

/**
 * The settings tab: plain DOM. It draws the settings in effect, and hands
 * each change to the plugin's Settings service.
 */
export class SettingsTab extends PluginSettingTab {
	plugin: TextEaterPluginStripped;

	constructor(app: App, plugin: TextEaterPluginStripped) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Applies `patch`. `redraw` draws the tab again once it is applied, to
	 * show what took effect, such as the old delimiter the files kept.
	 */
	private update(
		patch: SettingsPatch,
		{ redraw = false }: { readonly redraw?: boolean } = {},
	): Promise<void> {
		return this.plugin
			.updateSettings(patch)
			.then(() => (redraw ? this.display() : undefined));
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.plugin.settings;
		if (!settings) {
			containerEl.setText("Textfresser is still loading its settings.");
			return;
		}
		const t = LOCALES[settings.languages.known];
		/** The delimiter in effect now, which a change may not have reached yet. */
		const delimiterNow = () =>
			(this.plugin.settings ?? settings).suffixDelimiter.symbol;

		new Setting(containerEl).setName(t.apiKeyHeading).setHeading();

		new Setting(containerEl)
			.setName(t.typesafeApiKey)
			.setDesc(t.typesafeApiKeyDesc)
			.addText((text) =>
				text
					.setPlaceholder(t.apiKeyPlaceholder)
					.setValue(settings.typesafeApiKey)
					.onChange((value) =>
						this.update({ typesafeApiKey: value }),
					),
			);

		new Setting(containerEl)
			.setName(t.openaiApiKey)
			.setDesc(t.openaiApiKeyDesc)
			.addText((text) =>
				text
					.setPlaceholder(t.apiKeyPlaceholder)
					.setValue(settings.openaiApiKey)
					.onChange((value) => this.update({ openaiApiKey: value })),
			);

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
					.setValue(settings.languages.known)
					.onChange((value) => {
						const parsed = KnownLanguageSchema.safeParse(value);
						if (!parsed.success) {
							return;
						}
						// The tab speaks the known language: draw it again.
						return this.update(
							{ languages: { known: parsed.data } },
							{ redraw: true },
						);
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
					.setValue(settings.languages.target)
					.onChange((value) => {
						const parsed = TargetLanguageSchema.safeParse(value);
						if (!parsed.success) {
							return;
						}
						return this.update({
							languages: { target: parsed.data },
						});
					});
			});

		// Actions settings (moved here, after Languages)
		new Setting(containerEl).setName(t.actionsHeading).setHeading();

		for (const def of Object.values(ACTION_DEFINITIONS)) {
			const { settingKey } = def;
			// Skip if no settingKey or only 1 placement option
			if (!settingKey || def.selectablePlacements.length <= 1) continue;

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
						.setValue(settings[settingKey])
						.onChange((value) => {
							const parsed =
								SelectionActionPlacementSchema.safeParse(value);
							if (!parsed.success) {
								return;
							}
							return this.update({ [settingKey]: parsed.data });
						});
				});
		}

		new Setting(containerEl)
			.setName(t.navButtonsPosition)
			.setDesc(t.navButtonsPositionDesc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("left", t.navButtonsLeft)
					.addOption("right", t.navButtonsRight)
					.setValue(settings.navButtonsPosition)
					.onChange((value) => {
						if (value !== "left" && value !== "right") {
							return;
						}
						return this.update({ navButtonsPosition: value });
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
					.setValue(settings.libraryRoot)
					.onChange((value) => this.update({ libraryRoot: value })),
			);

		new Setting(containerEl)
			.setName(t.maxSectionDepth)
			.setDesc(t.maxSectionDepthDesc)
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(settings.maxSectionDepth)
					.setDynamicTooltip()
					.onChange((value) =>
						this.update({ maxSectionDepth: value }),
					),
			);

		new Setting(containerEl)
			.setName(t.showScrollsDepth)
			.setDesc(t.showScrollsDepthDesc)
			.addSlider((slider) =>
				slider
					.setLimits(0, 10, 1)
					.setValue(settings.showScrollsInCodexesForDepth)
					.setDynamicTooltip()
					.onChange((value) =>
						this.update({ showScrollsInCodexesForDepth: value }),
					),
			);

		new Setting(containerEl)
			.setName(t.suffixDelimiter)
			.setDesc(t.suffixDelimiterDesc)
			.addText((text) => {
				text.setPlaceholder(t.suffixDelimiterPlaceholder).setValue(
					settings.suffixDelimiter.symbol,
				);

				text.inputEl.addEventListener("blur", () => {
					const value = text.getValue().trim();
					// Validate length: 1-3 chars
					if (value.length < 1 || value.length > 3) {
						new Notice(t.delimiterLengthError);
						text.setValue(delimiterNow());
						return;
					}
					// Validate no spaces
					if (value.includes(" ")) {
						new Notice(t.delimiterSpacesError);
						text.setValue(delimiterNow());
						return;
					}
					// Validate each char against forbidden list
					for (const char of value) {
						if (FORBIDDEN_DELIMITER_CHARS.includes(char)) {
							new Notice(t.delimiterForbiddenCharError(char));
							text.setValue(delimiterNow());
							return;
						}
					}
					// Only save if value changed. The files may keep the old
					// delimiter, so draw what took effect.
					if (value !== delimiterNow()) {
						void this.update(
							{ suffixDelimiter: { symbol: value } },
							{ redraw: true },
						);
					}
				});
			});

		new Setting(containerEl)
			.setName(t.wrapDelimiter)
			.setDesc(t.wrapDelimiterDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.suffixDelimiter.padded)
					.onChange((value) =>
						this.update(
							{ suffixDelimiter: { padded: value } },
							{ redraw: true },
						),
					),
			);

		new Setting(containerEl)
			.setName(t.showBacklinks)
			.setDesc(t.showBacklinksDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.showScrollBacklinks)
					.onChange((value) =>
						this.update({ showScrollBacklinks: value }),
					),
			);

		new Setting(containerEl)
			.setName(t.hideMetadata)
			.setDesc(t.hideMetadataDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.hideMetadata)
					.onChange((value) => this.update({ hideMetadata: value })),
			);
	}
}
