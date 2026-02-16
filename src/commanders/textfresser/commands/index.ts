import { generateCommand } from "./generate/generate-command";
import { translateCommand } from "./translate/translate-command";
import {
	type ActionCommandKind,
	type CommandFn,
	TextfresserCommandKind,
} from "./types";

export const actionCommandFnForCommandKind = {
	[TextfresserCommandKind.Generate]: generateCommand,
	[TextfresserCommandKind.TranslateSelection]: translateCommand,
} satisfies Record<ActionCommandKind, CommandFn>;
