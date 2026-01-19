import { z } from "zod";
import type { TexfresserObsidianServices } from "../../obsidian-services/interface";

const USER_ACTION_LITERALS = [
	"Generate",
	"AddContext",
	"SplitContexts",
	"SplitInBlocks",
	"SplitToPages",
	"TranslateSelection",
	"TranslateBlock",
	"ExplainGrammar",
	"MakeText",
	"NavigatePage",
	"PreviousPage",
] as const;

const USER_ACTION_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

export const UserActionSchema = z.enum(USER_ACTION_LITERALS);

export type UserAction = z.infer<typeof UserActionSchema>;
export const UserAction = UserActionSchema.enum;
export const ALL_USER_ACTIONS = UserActionSchema.options;

export const UserActionPlacementSchema = z.enum(USER_ACTION_PLACEMENT_LITERALS);

export type UserActionPlacement = z.infer<typeof UserActionPlacementSchema>;
export const UserActionPlacement = UserActionPlacementSchema.enum;
export const USER_ACTION_PLACEMENTS = UserActionPlacementSchema.options;

export type ActionConfig<A extends UserAction> = {
	id: A;
	execute: (services: Partial<TexfresserObsidianServices>) => void;
	label: string;
	placement: UserActionPlacement;
};

export type AnyActionConfig = ActionConfig<UserAction>;
