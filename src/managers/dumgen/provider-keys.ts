/**
 * The provider keys dumgen's transports send with: TypeSafe's for jev,
 * OpenAI's for Luna. In the plugin they are read from its settings on
 * every use, so a key the user changes applies to the next action.
 */
import { Context, Effect, Layer } from "effect";
import type { DumgenProviderKeys } from "./providers";

export class ProviderKeys extends Context.Service<
	ProviderKeys,
	{ readonly current: Effect.Effect<DumgenProviderKeys> }
>()("textfresser/managers/dumgen/ProviderKeys") {
	/** The keys `read` answers, read on each use. */
	static readonly layer = (read: () => DumgenProviderKeys) =>
		Layer.succeed(
			ProviderKeys,
			ProviderKeys.of({ current: Effect.sync(read) }),
		);
}
