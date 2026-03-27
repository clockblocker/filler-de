/**
 * GenericClickDetector - shared click stream for specialized click detectors.
 *
 * Uses mousedown in capture phase to catch clicks before re-renders.
 * Specialized detectors subscribe and filter for their specific targets.
 *
 * When a subscriber calls evt.preventDefault() on mousedown, this detector
 * also blocks the subsequent mouseup and click events to prevent Obsidian
 * from toggling checkboxes (Obsidian uses mouseup for checkbox toggling).
 */

export type RawClickHandler = (target: HTMLElement, evt: MouseEvent) => void;

export class GenericClickDetector {
	private subscribers = new Set<RawClickHandler>();
	private mousedownHandler: ((evt: MouseEvent) => void) | null = null;
	private mouseupHandler: ((evt: MouseEvent) => void) | null = null;
	private clickHandler: ((evt: MouseEvent) => void) | null = null;

	/** Track whether the last mousedown was handled (preventDefault called) */
	private lastHandledMousedownTarget: EventTarget | null = null;

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
	 * Also listens to mouseup + click to block them when mousedown was handled.
	 */
	startListening(): void {
		if (this.mousedownHandler) return;

		this.mousedownHandler = (evt: MouseEvent) => {
			// Reset handled state for each new mousedown
			this.lastHandledMousedownTarget = null;

			// Only handle left mouse button
			if (evt.button !== 0) return;

			const target = evt.target as HTMLElement;
			for (const subscriber of this.subscribers) {
				subscriber(target, evt);
			}

			// If any subscriber called preventDefault, track the target
			if (evt.defaultPrevented) {
				this.lastHandledMousedownTarget = evt.target;
			}
		};

		this.mouseupHandler = (evt: MouseEvent) => {
			// Block mouseup if the corresponding mousedown was handled
			if (
				this.lastHandledMousedownTarget &&
				evt.target === this.lastHandledMousedownTarget
			) {
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation();
			}
		};

		this.clickHandler = (evt: MouseEvent) => {
			// Block click if the corresponding mousedown was handled
			if (
				this.lastHandledMousedownTarget &&
				evt.target === this.lastHandledMousedownTarget
			) {
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation();
				// Reset after click (end of event sequence)
				this.lastHandledMousedownTarget = null;
			}
		};

		document.addEventListener("mousedown", this.mousedownHandler, {
			capture: true,
		});
		document.addEventListener("mouseup", this.mouseupHandler, {
			capture: true,
		});
		document.addEventListener("click", this.clickHandler, {
			capture: true,
		});
	}

	/**
	 * Stop listening to document clicks.
	 */
	stopListening(): void {
		if (this.mousedownHandler) {
			document.removeEventListener("mousedown", this.mousedownHandler, {
				capture: true,
			});
			this.mousedownHandler = null;
		}
		if (this.mouseupHandler) {
			document.removeEventListener("mouseup", this.mouseupHandler, {
				capture: true,
			});
			this.mouseupHandler = null;
		}
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler, {
				capture: true,
			});
			this.clickHandler = null;
		}
		this.lastHandledMousedownTarget = null;
	}
}
