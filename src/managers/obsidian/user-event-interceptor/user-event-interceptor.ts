/**
 * UserEventInterceptor - unified facade for all user event detectors.
 *
 * Combines:
 * - ClickDetector: checkbox clicks (task + property)
 * - ClipboardDetector: copy/cut events
 * - SelectAllDetector: Ctrl/Cmd+A
 * - WikilinkDetector: wikilink completions
 *
 * Provides single subscription point for all user events.
 */

import type { App, Plugin } from "obsidian";
import { logger } from "../../../utils/logger";
import type { VaultActionManager } from "../vault-action-manager";
import { ActionClickDetector } from "./detectors/action-click-detector";
import { ClickDetector } from "./detectors/click-detector";
import { ClipboardDetector } from "./detectors/clipboard-detector";
import type { Detector } from "./detectors/detector";
import { SelectAllDetector } from "./detectors/select-all-detector";
import { SelectionDetector } from "./detectors/selection-detector";
import { WikilinkDetector } from "./detectors/wikilink-detector";
import type { Teardown, UserEvent, UserEventHandler } from "./types/user-event";

export class UserEventInterceptor {
	private readonly subscribers = new Set<UserEventHandler>();
	private readonly detectors: Detector[];
	private listening = false;

	constructor(
		app: App,
		plugin: Plugin,
		vaultActionManager: VaultActionManager,
	) {
		this.detectors = [
			new ClickDetector(app, vaultActionManager),
			new ClipboardDetector(app),
			new SelectAllDetector(app),
			new WikilinkDetector(plugin),
			new ActionClickDetector(),
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

		for (const detector of this.detectors) {
			detector.stopListening();
		}
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
