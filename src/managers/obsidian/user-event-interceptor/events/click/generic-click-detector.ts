/**
 * GenericClickDetector - shared click stream for specialized click detectors.
 *
 * Uses mousedown in capture phase to catch clicks before re-renders.
 * Specialized detectors subscribe and filter for their specific targets.
 */

export type RawClickHandler = (target: HTMLElement, evt: MouseEvent) => void;

export class GenericClickDetector {
	private subscribers = new Set<RawClickHandler>();
	private handler: ((evt: MouseEvent) => void) | null = null;

	/**
	 * Subscribe to raw click events.
	 * @returns Unsubscribe function
	 */
	subscribe(handler: RawClickHandler): () => void {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Start listening to document clicks.
	 * Uses mousedown + capture phase to intercept before re-renders.
	 */
	startListening(): void {
		if (this.handler) return;

		this.handler = (evt: MouseEvent) => {
			// Only handle left mouse button
			if (evt.button !== 0) return;

			const target = evt.target as HTMLElement;
			for (const subscriber of this.subscribers) {
				subscriber(target, evt);
			}
		};

		document.addEventListener("mousedown", this.handler, { capture: true });
	}

	/**
	 * Stop listening to document clicks.
	 */
	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("mousedown", this.handler, {
				capture: true,
			});
			this.handler = null;
		}
	}
}
