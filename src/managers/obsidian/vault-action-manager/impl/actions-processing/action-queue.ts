import { ok } from "neverthrow";
import {
	decrementPending,
	incrementPending,
} from "../../../../../utils/idle-tracker";
import type { VaultAction } from "../../types/vault-action";
import type { Dispatcher, DispatchResult } from "./dispatcher";

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
	private readonly maxBatches = 10;

	constructor(private readonly dispatcher: Dispatcher) {}

	/**
	 * Dispatch actions to queue.
	 * If call stack is empty, executes immediately.
	 * Otherwise, queues actions for later execution.
	 */
	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		// Add to queue (unlimited actions per batch)
		this.queue.push(...actions);

		// If call stack is empty, execute immediately
		if (!this.isExecuting) {
			return this.executeNextBatch();
		}

		// Otherwise, actions queued - will execute when current batch completes
		return ok(undefined);
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

		// Check batch limit
		if (this.batchCount >= this.maxBatches) {
			// Drop oldest half of queue to make room
			const dropCount = Math.floor(this.queue.length / 2);
			this.queue.splice(0, dropCount);
			// Could return error here, but dropping is safer for now
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

			this.isExecuting = false;
			return result;
		} finally {
			// Decrement only when all batches complete (isExecuting becomes false)
			if (!this.isExecuting) {
				decrementPending();
			}
		}
	}
}
