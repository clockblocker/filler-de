import { err, ok } from "neverthrow";
import {
	decrementPending,
	incrementPending,
} from "../../../../../utils/idle-tracker";
import { logger } from "../../../../../utils/logger";
import type { VaultAction } from "../../types/vault-action";
import type { Dispatcher, DispatchResult } from "./dispatcher";

export type ActionQueueOpts = {
	/** Max recursive batches before overflow (default: 10) */
	maxBatches?: number;
};

/**
 * ActionQueue implements call stack + event queue pattern.
 *
 * - Queue by default: all `dispatch()` calls go to queue
 * - Execute immediately if call stack is empty
 * - If executing: queue actions, execute when current batch completes
 * - Max 10 batches (unlimited actions per batch)
 * - Auto-continue: when batch completes, check queue and execute if more
 *
 * Dispatcher handles collapse + sort (queue is simple FIFO).
 */
export class ActionQueue {
	private queue: VaultAction[] = []; // Simple FIFO queue
	private isExecuting = false; // "Call stack" state
	private batchCount = 0;
	private readonly maxBatches: number;
	/** Resolvers waiting for queue to drain */
	private drainWaiters: Array<() => void> = [];

	constructor(
		private readonly dispatcher: Dispatcher,
		opts?: ActionQueueOpts,
	) {
		this.maxBatches = opts?.maxBatches ?? 10;
	}

	/**
	 * Dispatch actions to queue.
	 * If call stack is empty, executes immediately and returns when done.
	 * Otherwise, queues actions and returns when they are eventually processed.
	 */
	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		// Add to queue (unlimited actions per batch)
		this.queue.push(...actions);

		// If call stack is empty, execute immediately
		if (!this.isExecuting) {
			return this.executeNextBatch();
		}

		// Otherwise, actions queued - wait for queue to drain
		// This ensures callers wait for their actions to complete
		await this.waitForDrain();
		return ok(undefined);
	}

	/**
	 * Wait for the queue to drain (all pending actions processed).
	 */
	private waitForDrain(): Promise<void> {
		return new Promise((resolve) => {
			this.drainWaiters.push(resolve);
		});
	}

	/**
	 * Signal all waiters that the queue has drained.
	 */
	private signalDrain(): void {
		const waiters = this.drainWaiters;
		this.drainWaiters = [];
		for (const resolve of waiters) {
			resolve();
		}
	}

	/**
	 * Execute next batch from queue.
	 * Registers with self-event tracker, dispatches, then checks for more.
	 */
	private async executeNextBatch(): Promise<DispatchResult> {
		if (this.queue.length === 0) {
			this.isExecuting = false;
			return ok(undefined);
		}

		// Check batch limit — overflow: log, drain, return err
		if (this.batchCount >= this.maxBatches) {
			const droppedCount = this.queue.length;
			const representative = this.queue[0];
			logger.warn(
				`[ActionQueue] Batch limit (${this.maxBatches}) reached, dropping ${droppedCount} queued actions`,
			);
			this.queue = [];
			this.isExecuting = false;
			decrementPending();
			this.signalDrain();
			return err([
				{
					action: representative ?? ({} as VaultAction),
					error: `ActionQueue overflow: batch limit ${this.maxBatches} reached, ${droppedCount} actions dropped`,
				},
			]);
		}

		const wasExecuting = this.isExecuting;
		this.isExecuting = true;
		this.batchCount++;

		// Track pending work: increment only when starting first batch
		if (!wasExecuting) {
			incrementPending();
		}

		try {
			// Take all queued actions as one batch (unlimited size)
			const batch = [...this.queue];
			this.queue = [];

			// Dispatch: collapse + sort + register paths + execute (handled by Dispatcher)
			// Path registration happens INSIDE Dispatcher after collapse
			// to ensure we track paths from the ACTUAL actions that will execute
			const result = await this.dispatcher.dispatch(batch);

			this.batchCount--;

			// When dispatched ops are done, check queue for more
			if (this.queue.length > 0) {
				// Recursively execute next batch
				return this.executeNextBatch();
			}

			// Queue is empty - we're done
			this.isExecuting = false;

			// Decrement pending only for outermost call (the one that started execution)
			if (!wasExecuting) {
				decrementPending();
			}

			// Always signal waiters when queue drains (regardless of call depth)
			this.signalDrain();

			return result;
		} catch (error) {
			// On error, also clean up
			this.isExecuting = false;
			if (!wasExecuting) {
				decrementPending();
			}
			this.signalDrain();
			throw error;
		}
	}
}
