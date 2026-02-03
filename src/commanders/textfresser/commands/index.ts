import { ResultAsync } from "neverthrow";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import { generateCommand } from "./generate/generate-command";
import { translateCommand } from "./translate/translate-command";
import {
	type CommandError,
	CommandErrorKind,
	type CommandFn,
	type CommandInput,
	TextfresserCommandKind,
} from "./types";

export const commandFnForCommandKind = {
	[TextfresserCommandKind.Generate]: generateCommand,
	[TextfresserCommandKind.Lemma]: (_input: CommandInput) =>
		ResultAsync.fromPromise(
			Promise.resolve([] as VaultAction[]),
			(): CommandError => ({
				kind: CommandErrorKind.UNUSED_STUB,
			}),
		),
	[TextfresserCommandKind.TranslateSelection]: translateCommand,
} satisfies Record<TextfresserCommandKind, CommandFn>;
