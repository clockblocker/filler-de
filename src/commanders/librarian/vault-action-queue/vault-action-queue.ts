import { decrementPending, incrementPending } from "../../../utils/idle-tracker";
import { logger } from "../../../utils/logger";

/**
 * Item in the processing queue.
 * @template T - Type of item to process
 */
export type QueueItem<T> = {
	item: T;
	resolve: () => void;
};

/**
 * VaultActionQueue serializes asynchronous processing of items.
 * Used for file system operations that must not interleave.
 *
 * @template T - Type of item to process
 */
export class VaultActionQueue<T> {
	private queue: QueueItem<T>[] = [];
	private processing = false;
	private drainResolvers: Set<() => void> = new Set();

	constructor(
		private readonly processor: (item: T) => Promise<void>,
		private readonly logTag: string = "[VaultActionQueue]",
	) {}

	/**
	 * Enqueue an item for processing.
	 * Returns a promise that resolves when the item has been processed.
	 */
	enqueue(item: T): Promise<void> {
		return new Promise((resolve) => {
			this.queue.push({ item, resolve });
			this.processQueue();
		});
	}

	/**
	 * Process queued items one at a time.
	 */
	private async processQueue(): Promise<void> {
		if (this.processing) return;
		this.processing = true;
		incrementPending();

		try {
			while (this.queue.length > 0) {
				const entry = this.queue.shift();
				if (!entry) continue;

				try {
					await this.processor(entry.item);
				} catch (error) {
					logger.error(
						`${this.logTag} Error processing item:`,
						error,
					);
				}

				entry.resolve();
			}
		} finally {
			this.processing = false;
			decrementPending();
			this.signalQueueDrained();
		}
	}

	/**
	 * Wait for the queue to drain and all processing to complete.
	 * Uses event-based signaling instead of polling.
	 */
	waitForDrain(): Promise<void> {
		if (this.queue.length === 0 && !this.processing) {
			return Promise.resolve();
		}
		return new Promise((resolve) => this.drainResolvers.add(resolve));
	}

	/**
	 * Signal all waiters that the queue has drained.
	 */
	private signalQueueDrained(): void {
		for (const resolve of this.drainResolvers) {
			resolve();
		}
		this.drainResolvers.clear();
	}
}
