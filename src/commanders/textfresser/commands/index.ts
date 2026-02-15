import { generateCommand } from "./generate/generate-command";
import { lemmaCommand } from "./lemma/lemma-command";
import { translateCommand } from "./translate/translate-command";
import { type CommandFn, TextfresserCommandKind } from "./types";

export const commandFnForCommandKind = {
	[TextfresserCommandKind.Generate]: generateCommand,
	[TextfresserCommandKind.Lemma]: lemmaCommand,
	[TextfresserCommandKind.TranslateSelection]: translateCommand,
} satisfies Record<TextfresserCommandKind, CommandFn>;
