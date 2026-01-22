/**
 * A scheduler for debouncing function calls by key.
 * Useful for coalescing rapid updates (e.g., recompute on layout change).
 */
export class DebounceScheduler {
	private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private defaultKey = "__default__";

	constructor(private delayMs: number) {}

	/**
	 * Schedule a function to run after the debounce delay.
	 * If called again with the same key before delay expires, resets the timer.
	 */
	schedule(fn: () => void, key?: string): void {
		const k = key ?? this.defaultKey;
		const existing = this.timers.get(k);
		if (existing) {
			clearTimeout(existing);
		}
		this.timers.set(
			k,
			setTimeout(() => {
				this.timers.delete(k);
				fn();
			}, this.delayMs),
		);
	}

	/**
	 * Cancel a pending scheduled call.
	 * If no key provided, cancels the default key.
	 */
	cancel(key?: string): void {
		const k = key ?? this.defaultKey;
		const timer = this.timers.get(k);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(k);
		}
	}

	/**
	 * Cancel all pending scheduled calls and cleanup.
	 */
	destroy(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
	}
}
