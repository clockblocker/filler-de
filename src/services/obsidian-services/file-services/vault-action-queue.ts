import {
	getActionKey,
	sortActionsByWeight,
	type VaultAction,
} from "./background/background-vault-actions";
import type { VaultActionExecutor } from "./background/vault-action-executor";

const DEFAULT_FLUSH_DELAY_MS = 200;

/**
 * Queue for batching vault actions.
 *
 * Features:
 * - Deduplication: later actions on same target overwrite earlier ones
 * - Debouncing: waits for activity to settle before flushing
 * - Sorting: executes actions in weight order (folders before files, etc.)
 */
export class VaultActionQueue {
	private queue: Map<string, VaultAction> = new Map();
	private flushTimeout: ReturnType<typeof setTimeout> | null = null;
	private flushDelayMs: number;
	private isFlushing = false;
	private pendingFlush = false;

	constructor(
		private executor: VaultActionExecutor,
		options: { flushDelayMs?: number } = {},
	) {
		this.flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
	}

	/**
	 * Add an action to the queue.
	 * If an action with the same key exists, it will be overwritten.
	 */
	push(action: VaultAction): void {
		const key = getActionKey(action);
		this.queue.set(key, action);
		this.scheduleFlush();
	}

	/**
	 * Add multiple actions to the queue.
	 */
	pushMany(actions: readonly VaultAction[]): void {
		for (const action of actions) {
			this.push(action);
		}
	}

	/**
	 * Get current queue size (for testing/debugging).
	 */
	get size(): number {
		return this.queue.size;
	}

	get isEmpty(): boolean {
		return this.queue.size === 0;
	}

	/**
	 * Get queued actions (for testing/debugging).
	 * Returns a copy to prevent external mutation.
	 */
	getQueuedActions(): VaultAction[] {
		return [...this.queue.values()];
	}

	/**
	 * Clear the queue without executing.
	 */
	clear(): void {
		this.queue.clear();
		this.cancelScheduledFlush();
	}

	/**
	 * Force immediate flush, bypassing debounce.
	 */
	async flushNow(): Promise<void> {
		this.cancelScheduledFlush();
		await this.flush();
	}

	private scheduleFlush(): void {
		if (this.isFlushing) {
			this.pendingFlush = true;
			return;
		}

		this.cancelScheduledFlush();

		this.flushTimeout = setTimeout(() => {
			this.flushTimeout = null;
			void this.flush();
		}, this.flushDelayMs);
	}

	private cancelScheduledFlush(): void {
		if (this.flushTimeout !== null) {
			clearTimeout(this.flushTimeout);
			this.flushTimeout = null;
		}
	}

	private async flush(): Promise<void> {
		if (this.queue.size === 0) {
			return;
		}

		const actions = [...this.queue.values()];
		this.queue.clear();

		const sortedActions = sortActionsByWeight(actions);

		this.isFlushing = true;
		try {
			await this.executor.execute(sortedActions);
		} finally {
			this.isFlushing = false;
		}

		if (this.pendingFlush) {
			this.pendingFlush = false;
			this.scheduleFlush();
		}
	}
}

// Legacy alias maintained during migration away from this queue impl.
export const DeprecatedVaultActionQueue = VaultActionQueue;
