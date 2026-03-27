/**
 * Idle tracker for E2E tests.
 * Tracks pending async work for event detectors.
 * Only active in E2E/test mode.
 */

let pendingCount = 0;

/**
 * Check if E2E mode is enabled.
 * Enabled via E2E=1 env var or build flag.
 */
function isE2E(): boolean {
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
