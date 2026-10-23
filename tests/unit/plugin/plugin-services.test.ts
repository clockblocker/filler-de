import { describe, expect, it } from "bun:test";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import { type Context, Effect, Exit, Layer, Scope } from "effect";
import { DictionaryStore } from "../../../src/lifecycle/dictionary-store-service";
import { Lifecycle } from "../../../src/lifecycle/lifecycle-supervisor";
import { Dumgen } from "../../../src/managers/dumgen";
import {
	ClassifyServices,
	composePluginServices,
	DictionaryReset,
	TextfresserCommands,
	UserEvents,
} from "../../../src/plugin/plugin-services";
import { Settings } from "../../../src/settings/settings-service";

describe("the plugin's services", () => {
	it("are built in order and released in reverse: user events first, the dictionary store last", async () => {
		const events: string[] = [];
		/** A part that records when it is built and released. */
		const part = <I, S>(tag: Context.Key<I, S>, name: string) =>
			Layer.effect(
				tag,
				Effect.acquireRelease(
					Effect.sync(() => {
						events.push(`build ${name}`);
						return {} as S;
					}),
					() =>
						Effect.sync(() => {
							events.push(`release ${name}`);
						}),
				),
			);
		const layer = composePluginServices({
			classify: part(ClassifyServices, "classify"),
			observation: Layer.effectDiscard(
				Effect.acquireRelease(
					Effect.sync(() => {
						events.push("build observation");
					}),
					() =>
						Effect.sync(() => {
							events.push("release observation");
						}),
				),
			),
			reset: part(DictionaryReset, "reset"),
			store: part(DictionaryStore, "store"),
			textfresser: part(TextfresserCommands, "textfresser"),
			userEvents: part(UserEvents, "user events"),
		}).pipe(
			Layer.provide(
				Layer.mergeAll(
					Layer.succeed(VaultActionManager, {} as never),
					Layer.succeed(Dumgen, {} as never),
					Layer.succeed(Lifecycle, {} as never),
					Layer.succeed(Settings, {} as never),
				),
			),
		);

		const scope = Scope.makeUnsafe();
		await Effect.runPromise(Layer.buildWithScope(layer, scope));
		await Effect.runPromise(Scope.close(scope, Exit.void));

		expect(events).toEqual([
			"build textfresser",
			"build store",
			"build classify",
			"build reset",
			"build observation",
			"build user events",
			"release user events",
			"release observation",
			"release reset",
			"release classify",
			"release store",
			"release textfresser",
		]);
	});
});
