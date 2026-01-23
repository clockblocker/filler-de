/**
 * UserEventInterceptor - unified facade for all user event detectors.
 *
 * Combines:
 * - CheckboxClickedDetector: checkbox clicks (task + property)
 * - ClipboardDetector: copy/cut events
 * - SelectAllDetector: Ctrl/Cmd+A
 * - WikilinkDetector: wikilink completions
 * - ActionClickDetector: [data-action] button clicks
 *
 * Provides single subscription point for all user events.
 */

import type { App, Plugin } from "obsidian";
import { logger } from "../../../utils/logger";
import type { VaultActionManager } from "../vault-action-manager";
import { ActionClickDetector } from "./detectors/action-click-detector";
import { CheckboxClickedDetector } from "./detectors/checkbox-clicked-detector";
import { ClipboardDetector } from "./detectors/clipboard-detector";
import type { Detector } from "./detectors/detector";
import { GenericClickDetector } from "./detectors/generic";
import { SelectAllDetector } from "./detectors/select-all-detector";
import { SelectionDetector } from "./detectors/selection-detector";
import { WikilinkDetector } from "./detectors/wikilink-detector";
import type { Teardown, UserEvent, UserEventHandler } from "./types/user-event";

export class UserEventInterceptor {
	private readonly subscribers = new Set<UserEventHandler>();
	private readonly detectors: Detector[];
	private readonly genericClickDetector: GenericClickDetector;
	private listening = false;

	constructor(
		app: App,
		plugin: Plugin,
		vaultActionManager: VaultActionManager,
	) {
		// Create shared generic click detector
		this.genericClickDetector = new GenericClickDetector();

		this.detectors = [
			new CheckboxClickedDetector(
				this.genericClickDetector,
				app,
				vaultActionManager,
			),
			new ClipboardDetector(app),
			new SelectAllDetector(app),
			new WikilinkDetector(plugin),
			new ActionClickDetector(this.genericClickDetector),
			new SelectionDetector(app),
		];
	}

	/**
	 * Subscribe to user events.
	 * Returns teardown function to unsubscribe.
	 */
	subscribe(handler: UserEventHandler): Teardown {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Start listening to all user events.
	 */
	startListening(): void {
		if (this.listening) return;

		this.listening = true;
		const emit = (event: UserEvent) => this.emit(event);

		// Start generic click detector first
		this.genericClickDetector.startListening();

		// Then start specialized detectors
		for (const detector of this.detectors) {
			detector.startListening(emit);
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

	private emit(event: UserEvent): void {
		for (const handler of this.subscribers) {
			try {
				handler(event);
			} catch (error) {
				logger.error("[UserEventInterceptor] Handler error:", error);
			}
		}
	}
}
