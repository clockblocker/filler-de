/**
 * The event layer: DOM listeners and one editor extension, held in the
 * scope it is made in, and the handlers set on it.
 *
 * Detectors stay plain and synchronous: inside each event they encode its
 * payload, ask the handler of its kind `doesApply`, and prevent the default
 * by it. A handled event then runs on the host's runtime, as one fiber that
 * handles it and applies the result. Closing the scope removes every
 * listener and the extension.
 */
import { Effect, MutableRef, Ref } from "effect";
import type {
	ObsidianEventLayer,
	UserEventHandler,
	UserEventKind,
	UserEventsHost,
} from "./contracts";
import { actionElementClick } from "./events/click/action-element/detector";
import { checkboxClick } from "./events/click/checkbox/detector";
import { frontmatterCheckboxClick } from "./events/click/checkbox-frontmatter/detector";
import { listenForClicks } from "./events/click/generic-click-detector";
import { wikilinkClick } from "./events/click/wikilink-click/detector";
import { listenForClipboard } from "./events/clipboard/detector";
import { listenForSelectAll } from "./events/select-all/detector";
import { listenForSelectionChanges } from "./events/selection-changed/detector";
import { wikilinkCompletionExtension } from "./events/wikilink/detector";
import { type EventDispatch, handled } from "./internal/dispatch";
import { PayloadKind } from "./types/payload-base";

type Handlers = ReadonlyMap<UserEventKind, UserEventHandler<UserEventKind>>;

/**
 * Kinds handled with no span: a selection change is frequent, and a
 * toolbar button's command opens its own root, `command.<kind>`.
 */
const UNTRACED: ReadonlySet<UserEventKind> = new Set([
	PayloadKind.SelectionChanged,
	PayloadKind.ActionElementClicked,
]);

/** The layer, listening while the scope is open. */
export const makeObsidianEventLayer = Effect.fnUntraced(function* (
	host: UserEventsHost,
) {
	// Read and written inside DOM events and by plain setters, so through
	// its cell; one handler per kind.
	const handlers = yield* Ref.make<Handlers>(new Map());

	const dispatch: EventDispatch = {
		decide: (kind, payload) => {
			const handler = Ref.getUnsafe(handlers).get(kind) as
				| UserEventHandler<typeof kind>
				| undefined;
			return handler?.doesApply(payload) ? handler : undefined;
		},
		host,
		run: (kind, handler, payload, apply) =>
			host.fork(kind, handled(handler, payload, apply), {
				traced: !UNTRACED.has(kind),
			}),
	};

	// The clicks, in this order, before any other mouse listener.
	yield* listenForClicks(dispatch, [
		checkboxClick(dispatch),
		frontmatterCheckboxClick(dispatch),
		actionElementClick(dispatch),
		wikilinkClick(dispatch),
	]);
	yield* listenForClipboard(dispatch);
	yield* listenForSelectAll(dispatch);
	yield* listenForSelectionChanges(dispatch);
	yield* host.editorExtension(wikilinkCompletionExtension(dispatch));

	const layer: ObsidianEventLayer = {
		setHandler: (kind, handler) => {
			const stored =
				handler as unknown as UserEventHandler<UserEventKind>;
			MutableRef.update(handlers.ref, (current) =>
				new Map(current).set(kind, stored),
			);
			return () =>
				MutableRef.update(handlers.ref, (current) => {
					if (current.get(kind) !== stored) return current;
					const next = new Map(current);
					next.delete(kind);
					return next;
				});
		},
	};
	return layer;
});
