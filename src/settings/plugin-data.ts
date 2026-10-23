/**
 * The plugin's stored data, `data.json`, over Obsidian's `loadData` and
 * `saveData`. It holds the settings, and nothing else.
 */
import { Context, Data, Effect, Layer } from "effect";
import type { Plugin } from "obsidian";
import type { TextEaterSettings } from "../types";
import { getErrorMessage } from "../utils/get-error-message";
import {
	holdsRetiredSettings,
	settingsFromStoredData,
} from "./stored-settings";

/** Reading or writing `data.json` failed. */
export class PluginDataError extends Data.TaggedError("PluginDataError")<{
	readonly operation: "load" | "save";
	/** What `loadData` or `saveData` rejected with. */
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Could not ${this.operation} Textfresser's settings: ${getErrorMessage(this.cause)}`;
	}
}

export class PluginData extends Context.Service<
	PluginData,
	{
		/**
		 * The stored settings: the defaults, overlaid with what `data.json`
		 * holds. Data an older version saved with retired keys, such as
		 * the Gemini key, is saved again without them.
		 */
		readonly load: Effect.Effect<TextEaterSettings, PluginDataError>;
		readonly save: (
			settings: TextEaterSettings,
		) => Effect.Effect<void, PluginDataError>;
	}
>()("textfresser/settings/PluginData") {
	static readonly layer = (plugin: Pick<Plugin, "loadData" | "saveData">) =>
		Layer.succeed(PluginData, makePluginData(plugin));
}

export function makePluginData(
	plugin: Pick<Plugin, "loadData" | "saveData">,
): PluginData["Service"] {
	const save = Effect.fn("PluginData.save")((settings: TextEaterSettings) =>
		Effect.tryPromise({
			catch: (cause) => new PluginDataError({ cause, operation: "save" }),
			try: () => plugin.saveData(settings),
		}),
	);
	const load = Effect.gen(function* () {
		const stored: unknown = yield* Effect.tryPromise({
			catch: (cause) => new PluginDataError({ cause, operation: "load" }),
			try: () => plugin.loadData(),
		});
		const settings = settingsFromStoredData(stored);
		if (holdsRetiredSettings(stored)) yield* save(settings);
		return settings;
	}).pipe(Effect.withSpan("PluginData.load"));
	return PluginData.of({ load, save });
}
