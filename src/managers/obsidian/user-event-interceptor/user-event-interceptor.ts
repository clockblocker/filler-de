import type {
	ObsidianEventLayer,
	ObsidianEventLayerDeps,
	UserEventHandler,
	UserEventKind,
	UserEventPayloadMap,
	UserEventResult,
} from "./contracts";
import { ActionElementDetector } from "./events/click/action-element/detector";
import { CheckboxClickedDetector } from "./events/click/checkbox/detector";
import { CheckboxFrontmatterDetector } from "./events/click/checkbox-frontmatter/detector";
import { GenericClickDetector } from "./events/click/generic-click-detector";
import { WikilinkClickDetector } from "./events/click/wikilink-click/detector";
import { ClipboardDetector } from "./events/clipboard/detector";
import { SelectAllDetector } from "./events/select-all/detector";
import { SelectionChangedDetector } from "./events/selection-changed/detector";
import { WikilinkDetector } from "./events/wikilink/detector";
import type { HandlerTeardown } from "./types/handler";
import type { AnyPayload, PayloadKind } from "./types/payload-base";

/**
 * Detector interface for lifecycle management.
 */
interface Detector {
	startListening(): void;
	stopListening(): void;
}

/**
 * Handler invoker function passed to detectors.
 * Returns true if a handler exists and applies, false otherwise.
 */
export type HandlerInvoker<P extends AnyPayload> = (payload: P) => {
	applies: boolean;
	invoke: () => Promise<UserEventResult<P["kind"]>>;
};

class ObsidianEventLayerImpl implements ObsidianEventLayer {
	private readonly genericClickDetector: GenericClickDetector;
	private readonly detectors: Detector[];
	private readonly handlers = new Map<
		UserEventKind,
		UserEventHandler<UserEventKind>
	>();
	private listening = false;

	constructor({ app, plugin, selectionTextSource }: ObsidianEventLayerDeps) {
		// Create shared generic click detector
		this.genericClickDetector = new GenericClickDetector();

		// Create all detectors with handler invoker
		this.detectors = [
			new ClipboardDetector(
				app,
				selectionTextSource,
				this.createInvoker.bind(this),
			),
			new CheckboxClickedDetector(
				this.genericClickDetector,
				app,
				this.createInvoker.bind(this),
			),
			new CheckboxFrontmatterDetector(
				this.genericClickDetector,
				app,
				this.createInvoker.bind(this),
			),
			new ActionElementDetector(
				this.genericClickDetector,
				this.createInvoker.bind(this),
			),
			new WikilinkClickDetector(
				this.genericClickDetector,
				app,
				this.createInvoker.bind(this),
			),
			new SelectAllDetector(app, this.createInvoker.bind(this)),
			new SelectionChangedDetector(app, this.createInvoker.bind(this)),
			new WikilinkDetector(plugin, this.createInvoker.bind(this)),
		];
	}

	/**
	 * Set a handler for a specific payload kind.
	 * Only one handler per kind is allowed.
	 * Returns teardown function to unregister.
	 */
	setHandler<K extends UserEventKind>(
		kind: K,
		handler: UserEventHandler<K>,
	): HandlerTeardown {
		this.handlers.set(kind, handler as UserEventHandler<UserEventKind>);
		return () => {
			if (this.handlers.get(kind) === handler) {
				this.handlers.delete(kind);
			}
		};
	}

	/**
	 * Start listening to all user events.
	 */
	start(): void {
		if (this.listening) return;

		this.listening = true;

		// Start generic click detector first
		this.genericClickDetector.startListening();

		// Then start specialized detectors
		for (const detector of this.detectors) {
			detector.startListening();
		}
	}

	/**
	 * Stop listening to all user events.
	 */
	stop(): void {
		if (!this.listening) return;

		this.listening = false;

		// Stop specialized detectors first
		for (const detector of this.detectors) {
			detector.stopListening();
		}

		// Stop generic click detector last
		this.genericClickDetector.stopListening();
	}

	// ─── Private ───

	/**
	 * Create a handler invoker for a specific payload kind.
	 * This is passed to detectors so they can check applicability and invoke handlers.
	 */
	private createInvoker<P extends AnyPayload>(
		kind: PayloadKind,
	): HandlerInvoker<P> {
		return (payload: P) => {
			const handler = this.handlers.get(kind) as
				| UserEventHandler<UserEventKind>
				| undefined;

			if (!handler) {
				return {
					applies: false,
					invoke: async () => ({ outcome: "passthrough" }),
				};
			}

			const applies = handler.doesApply(payload as never);

			return {
				applies,
				invoke: async () => {
					if (!applies) {
						return { outcome: "passthrough" } as UserEventResult<
							P["kind"]
						>;
					}
					return handler.handle(payload as never) as UserEventResult<
						P["kind"]
					>;
				},
			};
		};
	}
}

export function createObsidianEventLayer(
	deps: ObsidianEventLayerDeps,
): ObsidianEventLayer {
	return new ObsidianEventLayerImpl(deps);
}
