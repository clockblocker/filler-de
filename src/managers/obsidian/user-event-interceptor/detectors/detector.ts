/**
 * Detector interface - common interface for all event detectors.
 */

import type { UserEvent } from "../types/user-event";

export type DetectorEmitter = (event: UserEvent) => void;

/**
 * Interface for event detectors.
 * Each detector listens for specific DOM/editor events and emits UserEvents.
 */
export interface Detector {
	/**
	 * Start listening for events.
	 * @param emit - Callback to emit detected events
	 */
	startListening(emit: DetectorEmitter): void;

	/**
	 * Stop listening for events.
	 */
	stopListening(): void;
}
