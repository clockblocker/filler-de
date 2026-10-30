/**
 * The plugin's services, each a Layer whose finalizer releases what it
 * holds. The launch builds them once Obsidian is ready, into the scope the
 * lifecycle owns (`composePluginServices`), and the overlay once the
 * Librarian first started (`OverlayLive`). Disposing the runtime stops the
 * lifecycle, which closes that scope: the finalizers run newest first,
 * before the Librarian stops and VAM shuts down.
 */
import type {
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Context, type Effect, Layer } from "effect";
import type {
	ClassifyCommander,
	KnowledgeQueue,
	OccurrenceAttester,
} from "../commanders/classify";
import type { ReadingLifetime } from "../commanders/classify/resolution/reading-lifetime";
import type { ScrollActivity } from "../commanders/classify/resolution/scroll-activity";
import type { UnlinkObserver } from "../commanders/classify/resolution/unlink-observer";
import type { SegmentationCache } from "../commanders/classify/segmentation-cache";
import type { DictionaryResetCommand } from "../commanders/dictionary-reset/reset-command";
import type { Textfresser } from "../commanders/textfresser/textfresser";
import type { DictionaryStore } from "../lifecycle/dictionary-store-service";
import type { OverlayManager } from "../managers/overlay-manager";
import type { PluginServices } from "../runtime/plugin-live";
import type { UserEvents } from "./user-events";

export { UserEvents } from "./user-events";

/**
 * The Textfresser commands for the languages in effect. A change of the
 * languages builds a new Textfresser, once, as it is next used.
 */
export class TextfresserCommands extends Context.Service<
	TextfresserCommands,
	{ readonly current: Effect.Effect<Textfresser> }
>()("textfresser/plugin/TextfresserCommands") {}

/** Classify and its background work: Knowledge runs, unlink and lifetime checks. */
export class ClassifyServices extends Context.Service<
	ClassifyServices,
	{
		readonly classify: ClassifyCommander;
		/** Attests the occurrence of a clicked unit link (#281). */
		readonly attester: OccurrenceAttester;
		/** Classify's background Knowledge runs, one per Reading (#64). */
		readonly knowledgeQueue: KnowledgeQueue;
		/** Removes the occurrences whose links the user deletes from a Scroll (#116). */
		readonly unlinkObserver: UnlinkObserver;
		/** Removes the Readings no Attestation or link names any more (#281). */
		readonly readingLifetime: ReadingLifetime;
		/** Reopens a clicked Reading note once its Knowledge lands (#116). */
		readonly reopenReading: (
			target: string,
		) => Effect.Effect<
			boolean,
			Effect.Error<ReturnType<VaultActionManager["cd"]>>
		>;
		readonly scrollActivity: ScrollActivity;
		readonly cache: SegmentationCache["Service"];
		readonly segmenterVersion: Effect.Effect<string>;
	}
>()("textfresser/plugin/ClassifyServices") {}

/** "Reset dictionary from old notes…" (#65). */
export class DictionaryReset extends Context.Service<
	DictionaryReset,
	DictionaryResetCommand
>()("textfresser/plugin/DictionaryReset") {}

export class Overlay extends Context.Service<Overlay, OverlayManager>()(
	"textfresser/plugin/Overlay",
) {}

/** The services the launch builds, in `composePluginServices`. */
export type PluginServicesOut =
	| TextfresserCommands
	| DictionaryStore
	| ClassifyServices
	| DictionaryReset
	| UserEvents;

export type ObservationError =
	| VamSetupError
	| VamShutdownError
	| VamSubscriptionError;

/** The parts `composePluginServices` builds, one Layer each. */
export type PluginServicesParts = {
	readonly textfresser: Layer.Layer<
		TextfresserCommands,
		never,
		PluginServices
	>;
	readonly store: Layer.Layer<DictionaryStore, never, PluginServices>;
	readonly classify: Layer.Layer<
		ClassifyServices,
		never,
		PluginServices | DictionaryStore
	>;
	readonly reset: Layer.Layer<
		DictionaryReset,
		never,
		PluginServices | DictionaryStore | ClassifyServices
	>;
	/** VAM's listening, and the subscriptions on it. */
	readonly observation: Layer.Layer<
		never,
		ObservationError,
		PluginServices | ClassifyServices
	>;
	readonly userEvents: Layer.Layer<UserEvents, never, PluginServices>;
};

/**
 * Builds the parts in this order, each once the parts before it, so their
 * finalizers run in reverse: the user events stop first, then VAM's
 * subscriptions, the dictionary reset, Classify's background work, and the
 * dictionary store last.
 */
export const composePluginServices = (
	parts: PluginServicesParts,
): Layer.Layer<PluginServicesOut, ObservationError, PluginServices> =>
	parts.userEvents.pipe(
		Layer.provideMerge(parts.observation),
		Layer.provideMerge(parts.reset),
		Layer.provideMerge(parts.classify),
		Layer.provideMerge(parts.store),
		Layer.provideMerge(parts.textfresser),
	);
