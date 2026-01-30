/**
 * Action definitions map - single source of truth for overlay actions.
 */

import { type ActionDefinition, OverlayActionKind, OverlayPlacement } from "./types";

export const ACTION_DEFINITIONS: Record<OverlayActionKind, ActionDefinition> = {
	[OverlayActionKind.Translate]: {
		id: OverlayActionKind.Translate,
		label: "Translate",
		requiresSelection: true,
		selectablePlacements: [OverlayPlacement.AboveSelection, OverlayPlacement.Bottom, OverlayPlacement.ShortcutOnly],
		settingKey: "translatePlacement",
	},
	[OverlayActionKind.SplitInBlocks]: {
		id: OverlayActionKind.SplitInBlocks,
		label: "Split in Blocks",
		requiresSelection: true,
		selectablePlacements: [OverlayPlacement.AboveSelection, OverlayPlacement.Bottom, OverlayPlacement.ShortcutOnly],
		settingKey: "splitInBlocksPlacement",
	},
	[OverlayActionKind.ExplainGrammar]: {
		id: OverlayActionKind.ExplainGrammar,
		label: "Explain Grammar",
		requiresSelection: true,
		selectablePlacements: [OverlayPlacement.AboveSelection, OverlayPlacement.Bottom, OverlayPlacement.ShortcutOnly],
		settingKey: "explainGrammarPlacement",
	},
	[OverlayActionKind.Generate]: {
		id: OverlayActionKind.Generate,
		label: "Generate",
		requiresSelection: false,
		selectablePlacements: [OverlayPlacement.Bottom, OverlayPlacement.ShortcutOnly],
		settingKey: "generatePlacement",
	},
	[OverlayActionKind.NavPrev]: {
		id: OverlayActionKind.NavPrev,
		label: "<",
		requiresSelection: false,
		selectablePlacements: [],
		settingKey: null,
	},
	[OverlayActionKind.NavNext]: {
		id: OverlayActionKind.NavNext,
		label: ">",
		requiresSelection: false,
		selectablePlacements: [],
		settingKey: null,
	},
};

export const KNOWN_ACTION_IDS = new Set(Object.keys(ACTION_DEFINITIONS));
