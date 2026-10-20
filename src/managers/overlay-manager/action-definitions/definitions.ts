/**
 * Action definitions map - single source of truth for overlay actions.
 */

import { CommandKind } from "../../obsidian/command-executor";
import {
	type ActionDefinition,
	type OverlayActionKind,
	OverlayPlacement,
} from "./types";

export const ACTION_DEFINITIONS: Record<OverlayActionKind, ActionDefinition> = {
	[CommandKind.TranslateSelection]: {
		id: CommandKind.TranslateSelection,
		label: "Translate",
		requiresSelection: true,
		selectablePlacements: [
			OverlayPlacement.AboveSelection,
			OverlayPlacement.Bottom,
			OverlayPlacement.ShortcutOnly,
		],
		settingKey: "translatePlacement",
	},
	[CommandKind.SplitInBlocks]: {
		id: CommandKind.SplitInBlocks,
		label: "Split in Blocks",
		requiresSelection: true,
		selectablePlacements: [
			OverlayPlacement.AboveSelection,
			OverlayPlacement.Bottom,
			OverlayPlacement.ShortcutOnly,
		],
		settingKey: "splitInBlocksPlacement",
	},
	// Classify replaced the legacy Generate action (#64); it keeps its
	// placement setting.
	[CommandKind.Classify]: {
		id: CommandKind.Classify,
		label: "Classify",
		requiresSelection: true,
		selectablePlacements: [
			OverlayPlacement.AboveSelection,
			OverlayPlacement.Bottom,
			OverlayPlacement.ShortcutOnly,
		],
		settingKey: "generatePlacement",
	},
	[CommandKind.GoToPrevPage]: {
		id: CommandKind.GoToPrevPage,
		label: "<",
		requiresSelection: false,
		selectablePlacements: [],
		settingKey: null,
	},
	[CommandKind.GoToNextPage]: {
		id: CommandKind.GoToNextPage,
		label: ">",
		requiresSelection: false,
		selectablePlacements: [],
		settingKey: null,
	},
};

export const KNOWN_ACTION_IDS = new Set(Object.keys(ACTION_DEFINITIONS));
