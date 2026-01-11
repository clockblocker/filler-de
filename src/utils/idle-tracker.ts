/**
 * Idle tracker for E2E tests.
 * Tracks pending async work and provides whenIdle() hook.
 * Only active in E2E/test mode.
 */

let pendingCount = 0;
const idleWaiters: Array<() => void> = [];

/**
 * Check if E2E mode is enabled.
 * Enabled via E2E=1 env var or build flag.
 */
export function isE2E(): boolean {
	// Check env var (set by test runner)
	if (typeof process !== "undefined" && process.env.E2E === "1") {
		return true;
	}
	// Check window global (set by test harness)
	if (typeof window !== "undefined") {
		const win = window as unknown as { __E2E_MODE?: boolean };
		return win.__E2E_MODE === true;
	}
	return false;
}

/**
 * Increment pending task count.
 * Call when starting async work.
 */
export function incrementPending(): void {
	if (!isE2E()) return;
	pendingCount++;
}

/**
 * Decrement pending task count.
 * Call when async work completes.
 */
export function decrementPending(): void {
	if (!isE2E()) return;
	if (pendingCount > 0) {
		pendingCount--;
	}
}

/**
 * Wait until all pending tasks complete (pendingCount === 0).
 * Uses heuristic: 1000ms grace period after count reaches 0, polling every 100ms.
 * Resets grace period if new work arrives.
 * Optionally also waits for Obsidian events to confirm actions are registered.
 * Only works in E2E mode.
 */
export async function whenIdle(
	waitForObsidian?: () => Promise<void>,
): Promise<void> {
	if (!isE2E()) {
		return Promise.resolve();
	}

	const POLL_INTERVAL_MS = 100;
	const GRACE_PERIOD_MS = 1000;

	// Wait for pendingCount to reach 0
	while (pendingCount > 0) {
		await new Promise<void>((resolve) =>
			setTimeout(resolve, POLL_INTERVAL_MS),
		);
	}

	// Start grace period: wait 1000ms with count staying at 0
	// Poll every 100ms and reset if new work arrives
	let gracePeriodStart = Date.now();
	while (true) {
		await new Promise<void>((resolve) =>
			setTimeout(resolve, POLL_INTERVAL_MS),
		);

		if (pendingCount > 0) {
			// New work arrived, wait for it to complete and reset grace period
			while (pendingCount > 0) {
				await new Promise<void>((resolve) =>
					setTimeout(resolve, POLL_INTERVAL_MS),
				);
			}
			gracePeriodStart = Date.now();
			continue;
		}

		// Check if grace period has elapsed
		const elapsed = Date.now() - gracePeriodStart;
		if (elapsed >= GRACE_PERIOD_MS) {
			break;
		}
	}

	// Optionally wait for Obsidian events
	if (waitForObsidian) {
		await waitForObsidian();
	}
}

/**
 * Get current pending count (for debugging).
 */
export function getPendingCount(): number {
	return pendingCount;
}

/**
 * Reset tracker (for test cleanup).
 */
export function reset(): void {
	pendingCount = 0;
	idleWaiters.length = 0;
}
