/**
 * Action definitions map - single source of truth for overlay actions.
 */

import { type ActionDefinition, OverlayActionKind } from "./types";

export const ACTION_DEFINITIONS: Record<OverlayActionKind, ActionDefinition> = {
	[OverlayActionKind.Translate]: {
		id: OverlayActionKind.Translate,
		label: "Translate",
		requiresSelection: true,
		settingKey: "translatePlacement",
	},
	[OverlayActionKind.SplitInBlocks]: {
		id: OverlayActionKind.SplitInBlocks,
		label: "Split in Blocks",
		requiresSelection: true,
		settingKey: "splitInBlocksPlacement",
	},
	[OverlayActionKind.ExplainGrammar]: {
		id: OverlayActionKind.ExplainGrammar,
		label: "Explain Grammar",
		requiresSelection: true,
		settingKey: "explainGrammarPlacement",
	},
	[OverlayActionKind.Generate]: {
		id: OverlayActionKind.Generate,
		label: "Generate",
		requiresSelection: false,
		settingKey: "generatePlacement",
	},
};

export const KNOWN_ACTION_IDS = new Set(Object.keys(ACTION_DEFINITIONS));
