import type { VaultEvent } from "../../../..";
import type { BulkWindow } from "../types/bulk/bulk-window";

export class BulkEventAccumulator {
	private buffer: VaultEvent[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;

	private windowStartedAt: number | null = null;

	constructor(
		private readonly onFlush: (window: BulkWindow) => void,
		private readonly opts: {
			/**
			 * Flush when no new events arrive for this long.
			 */
			quietWindowMs: number;

			/**
			 * Safety cap: flush even if events keep arriving.
			 * Helps for large moves that emit events continuously.
			 */
			maxWindowMs: number;
		} = { maxWindowMs: 2000, quietWindowMs: 250 },
	) {}

	/**
	 * Add a vault event to the current bulk window.
	 * Starts a new window if needed and extends the window on each call.
	 */
	push(event: VaultEvent): void {
		const now = Date.now();

		// Start a new window on first event
		if (this.windowStartedAt === null) {
			this.windowStartedAt = now;
		}

		this.buffer.push(event);

		this.resetTimer();

		// Safety: force flush if max window exceeded
		if (
			this.windowStartedAt !== null &&
			now - this.windowStartedAt >= this.opts.maxWindowMs
		) {
			this.flush(now);
		}
	}

	/**
	 * Force-flush current window if non-empty.
	 */
	flushNow(): void {
		this.flush(Date.now());
	}

	/**
	 * Stop timers and drop buffered events (no flush).
	 * Use when tearing down listeners.
	 */
	clear(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.buffer = [];
		this.windowStartedAt = null;
	}

	private resetTimer(): void {
		if (this.timer) clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.flush(Date.now());
		}, this.opts.quietWindowMs);
	}

	private flush(endedAt: number): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.buffer.length === 0) {
			this.windowStartedAt = null;
			return;
		}

		const startedAt = this.windowStartedAt ?? endedAt;

		const events = this.buffer;
		this.buffer = [];
		this.windowStartedAt = null;

		this.onFlush({
			allObsidianEvents: events,
			debug: { endedAt, startedAt },
		});
	}
}
