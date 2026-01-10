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
 * Resolves idle waiters if count reaches 0.
 */
export function decrementPending(): void {
	if (!isE2E()) return;
	if (pendingCount > 0) {
		pendingCount--;
	}
	if (pendingCount === 0) {
		// Resolve all waiters
		const waiters = [...idleWaiters];
		idleWaiters.length = 0;
		for (const resolve of waiters) {
			resolve();
		}
	}
}

/**
 * Wait until all pending tasks complete (pendingCount === 0).
 * Optionally also waits for Obsidian events to confirm actions are registered.
 * Only works in E2E mode.
 */
export async function whenIdle(
	waitForObsidian?: () => Promise<void>,
): Promise<void> {
	if (!isE2E()) {
		return Promise.resolve();
	}

	// Wait for pending tasks to complete
	await new Promise<void>((resolve) => {
		if (pendingCount === 0) {
			resolve();
			return;
		}
		idleWaiters.push(() => resolve());
	});

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
