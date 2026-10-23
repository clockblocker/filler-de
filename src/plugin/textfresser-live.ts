/** The Textfresser commands, as a Layer that follows the languages in effect. */
import { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Layer, Ref } from "effect";
import { Textfresser } from "../commanders/textfresser/textfresser";
import { Dumgen } from "../managers/dumgen";
import { Settings } from "../settings/settings-service";
import type { LanguagesConfig } from "../types";
import { TextfresserCommands } from "./plugin-services";

/**
 * A Textfresser for the languages in effect: the one built last, unless
 * the languages changed since, which builds a new one.
 */
export const TextfresserLive = Layer.effect(
	TextfresserCommands,
	Effect.gen(function* () {
		const vam = yield* VaultActionManager;
		const dumgen = yield* Dumgen;
		const settings = yield* Settings;
		const make = (languages: LanguagesConfig) => ({
			languages,
			textfresser: new Textfresser(vam, languages, dumgen.provide),
		});
		const built = yield* Ref.make(make((yield* settings.get).languages));
		return {
			current: Effect.flatMap(settings.get, ({ languages }) =>
				Ref.modify(built, (last) => {
					const next = sameLanguages(last.languages, languages)
						? last
						: make(languages);
					return [next.textfresser, next];
				}),
			),
		};
	}),
);

const sameLanguages = (a: LanguagesConfig, b: LanguagesConfig) =>
	a.known === b.known && a.target === b.target;
