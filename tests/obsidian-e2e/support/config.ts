export const PLUGIN_ID = "cbcr-text-eater-de";

export const TIMEOUT_DEFAULT_MS = 15000;
export const INTERVAL_DEFAULT_MS = 200;
export const MAX_ATTEMPTS_DEFAULT = 10;

/** Time to wait for plugin init + initial healing before each test */
export const INIT_HEALING_WAIT_MS = 0;
export const EXTRA_INIT_HEALING_WAIT_MS = 0;

// Offsets (keep if you still want per-action tuning)
export const OFFSET_AFTER_FILE_DELETION = { intervalOffset: 0, timeoutOffset: 0 };
export const OFFSET_AFTER_HEAL = { intervalOffset: 0, timeoutOffset: 0 };

/** Polling options for healing tests (codex creation, file registration) */
export const HEALING_POLL_OPTIONS = {
	intervalMs: 200,
	timeoutMs: 15000,
} as const;