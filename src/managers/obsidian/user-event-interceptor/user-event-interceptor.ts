/**
 * UserEventInterceptor - unified facade for user event detection with handler pattern.
 *
 * Architecture:
 * - Raw DOM events are captured by detectors
 * - Events are encoded into payloads via codecs
 * - Single handler per event type transforms/handles payload
 * - Default actions apply final transformations
 *
 * Detectors:
 * - ClipboardDetector: copy/cut events
 * - CheckboxClickedDetector: task checkbox clicks
 * - CheckboxFrontmatterDetector: property checkbox clicks
 * - ActionElementDetector: [data-action] button clicks
 * - SelectAllDetector: Ctrl/Cmd+A
 * - SelectionChangedDetector: text selection changes
 * - WikilinkDetector: wikilink completions
 */

import type { App, Plugin } from "obsidian";

import type { VaultActionManager } from "../vault-action-manager";
import { ActionElementDetector } from "./events/click/action-element/detector";
import { CheckboxClickedDetector } from "./events/click/checkbox/detector";
import { CheckboxFrontmatterDetector } from "./events/click/checkbox-frontmatter/detector";
import { GenericClickDetector } from "./events/click/generic-click-detector";
import { ClipboardDetector } from "./events/clipboard/detector";
import { SelectAllDetector } from "./events/select-all/detector";
import { SelectionChangedDetector } from "./events/selection-changed/detector";
import { WikilinkDetector } from "./events/wikilink/detector";
import {
	type EventHandler,
	type HandlerContext,
	HandlerOutcome,
	type HandlerTeardown,
} from "./types/handler";
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
	invoke: () => Promise<{
		outcome: HandlerOutcome;
		data?: P;
	}>;
};

export class UserEventInterceptor {
	private readonly genericClickDetector: GenericClickDetector;
	private readonly detectors: Detector[];
	private readonly handlers = new Map<
		PayloadKind,
		EventHandler<AnyPayload>
	>();
	private readonly ctx: HandlerContext;
	private listening = false;

	constructor(
		app: App,
		plugin: Plugin,
		vaultActionManager: VaultActionManager,
	) {
		this.ctx = { app, vaultActionManager };

		// Create shared generic click detector
		this.genericClickDetector = new GenericClickDetector();

		// Create all detectors with handler invoker
		this.detectors = [
			new ClipboardDetector(app, this.createInvoker.bind(this)),
			new CheckboxClickedDetector(
				this.genericClickDetector,
				app,
				vaultActionManager,
				this.createInvoker.bind(this),
			),
			new CheckboxFrontmatterDetector(
				this.genericClickDetector,
				vaultActionManager,
				this.createInvoker.bind(this),
			),
			new ActionElementDetector(
				this.genericClickDetector,
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
	setHandler<P extends AnyPayload>(
		kind: PayloadKind,
		handler: EventHandler<P>,
	): HandlerTeardown {
		this.handlers.set(kind, handler as EventHandler<AnyPayload>);
		return () => {
			if (this.handlers.get(kind) === handler) {
				this.handlers.delete(kind);
			}
		};
	}

	/**
	 * Start listening to all user events.
	 */
	startListening(): void {
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
	stopListening(): void {
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
				| EventHandler<P>
				| undefined;

			if (!handler) {
				return {
					applies: false,
					invoke: async () => ({
						outcome: HandlerOutcome.Passthrough,
					}),
				};
			}

			const applies = handler.doesApply(payload);

			return {
				applies,
				invoke: async () => {
					if (!applies) {
						return { outcome: HandlerOutcome.Passthrough };
					}
					const result = await handler.handle(payload, this.ctx);
					if (result.outcome === HandlerOutcome.Modified) {
						return {
							data: result.data,
							outcome: HandlerOutcome.Modified,
						};
					}
					return { outcome: result.outcome };
				},
			};
		};
	}
}

