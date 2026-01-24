/**
 * UserEventInterceptor - unified facade for user event detection with behavior chain.
 *
 * Architecture:
 * - Raw DOM events are captured by detectors
 * - Events are encoded into payloads via codecs
 * - Behavior chain transforms payloads
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
 *
 * Legacy Support:
 * - subscribe() method bridges to old event pattern
 * - LegacyBridge converts new payloads to old UserEvents
 */

import type { App, Plugin } from "obsidian";
import type { VaultActionManager } from "../vault-action-manager";
import type { BehaviorRegistry } from "./behavior-chain";
import { getBehaviorRegistry } from "./behavior-chain";
import { ActionElementDetector } from "./events/click/action-element/detector";
import { CheckboxClickedDetector } from "./events/click/checkbox/detector";
import { CheckboxFrontmatterDetector } from "./events/click/checkbox-frontmatter/detector";
import { GenericClickDetector } from "./events/click/generic-click-detector";
import { ClipboardDetector } from "./events/clipboard/detector";
import { SelectAllDetector } from "./events/select-all/detector";
import { SelectionChangedDetector } from "./events/selection-changed/detector";
import { WikilinkDetector } from "./events/wikilink/detector";
import { createLegacyBridge, type LegacyBridge } from "./legacy-bridge";
import type { Teardown, UserEventHandler } from "./types/user-event";

/**
 * Detector interface for lifecycle management.
 */
interface Detector {
	startListening(): void;
	stopListening(): void;
}

export class UserEventInterceptor {
	private readonly genericClickDetector: GenericClickDetector;
	private readonly detectors: Detector[];
	private readonly behaviorRegistry: BehaviorRegistry;
	private readonly legacyBridge: LegacyBridge;
	private listening = false;

	constructor(
		app: App,
		plugin: Plugin,
		vaultActionManager: VaultActionManager,
	) {
		this.behaviorRegistry = getBehaviorRegistry();
		this.legacyBridge = createLegacyBridge();

		// Create shared generic click detector
		this.genericClickDetector = new GenericClickDetector();

		// Create all detectors
		this.detectors = [
			new ClipboardDetector(app, vaultActionManager),
			new CheckboxClickedDetector(
				this.genericClickDetector,
				app,
				vaultActionManager,
			),
			new CheckboxFrontmatterDetector(
				this.genericClickDetector,
				app,
				vaultActionManager,
			),
			new ActionElementDetector(
				this.genericClickDetector,
				app,
				vaultActionManager,
			),
			new SelectAllDetector(app, vaultActionManager),
			new SelectionChangedDetector(app, vaultActionManager),
			new WikilinkDetector(plugin, app, vaultActionManager),
		];
	}

	/**
	 * Get the behavior registry for registering behaviors.
	 */
	getBehaviorRegistry(): BehaviorRegistry {
		return this.behaviorRegistry;
	}

	/**
	 * Subscribe to user events (legacy pattern).
	 * Returns teardown function to unsubscribe.
	 *
	 * @deprecated Use behavior registration instead for new code.
	 */
	subscribe(handler: UserEventHandler): Teardown {
		return this.legacyBridge.subscribe(handler);
	}

	/**
	 * Start listening to all user events.
	 */
	startListening(): void {
		if (this.listening) return;

		this.listening = true;

		// Register legacy bridge behaviors
		this.legacyBridge.registerBridgeBehaviors();

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

		// Unregister legacy bridge behaviors
		this.legacyBridge.unregisterBridgeBehaviors();
		this.legacyBridge.clearSubscribers();
	}
}
