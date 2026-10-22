/**
 * The name a VAM caller dispatches and subscribes under, such as
 * `"librarian"` or `"dictionary"`. VAM gives it no meaning beyond telling
 * callers apart.
 */
export type VamCaller = string;

/** Names one Dispatch Batch, in its report, its spans and its events. */
export type VamOperationId = string;

/** One Dispatch Batch: who submitted it, and its id. */
export type VamOperation = {
	readonly caller: VamCaller;
	readonly operationId: VamOperationId;
};

/**
 * Who caused a delivered vault event:
 *
 * - `Vam`: a Dispatch Batch, attributed by its Self Event windows.
 * - `LinkUpdate`: Obsidian's link updater, rewriting a file while or just
 *   after a VAM rename with link updating ran (Markdown modifications only).
 * - `External`: anything else: the user, Sync, another plugin, or a VAM
 *   write routed to the open editor.
 *
 * Attribution goes by timing windows, so a label can be wrong; a wrong
 * label reaches the subscribers that filter on it, never the others.
 */
export type VaultEventOrigin =
	| {
			readonly kind: "Vam";
			readonly caller: VamCaller;
			readonly operationId: VamOperationId;
	  }
	| { readonly kind: "LinkUpdate"; readonly operationId: VamOperationId }
	| { readonly kind: "External" };

export const EXTERNAL_ORIGIN: VaultEventOrigin = { kind: "External" };

export function vamOrigin(operation: VamOperation): VaultEventOrigin {
	return {
		caller: operation.caller,
		kind: "Vam",
		operationId: operation.operationId,
	};
}

/**
 * Which events a subscription receives, by origin:
 *
 * - `external` (the default): all but VAM's own writes. `LinkUpdate`
 *   rewrites are Obsidian's, so they arrive, as before origins existed.
 * - `allButMine`: also other callers' writes; only `caller`'s are left out.
 * - `all`: everything, VAM's own writes included.
 */
export type VamSubscribeOptions =
	| { readonly from?: "external" }
	| { readonly from: "all" }
	| { readonly from: "allButMine"; readonly caller: VamCaller };

/** What a subscription keeps: a predicate and a key shared by equal filters. */
export type OriginFilter = {
	readonly accepts: (origin: VaultEventOrigin) => boolean;
	readonly key: string;
};

export function originFilter(options: VamSubscribeOptions = {}): OriginFilter {
	switch (options.from) {
		case "all":
			return { accepts: () => true, key: "all" };
		case "allButMine": {
			const { caller } = options;
			return {
				accepts: (origin) =>
					origin.kind !== "Vam" || origin.caller !== caller,
				key: `allButMine:${caller}`,
			};
		}
		default:
			return {
				accepts: (origin) => origin.kind !== "Vam",
				key: "external",
			};
	}
}
