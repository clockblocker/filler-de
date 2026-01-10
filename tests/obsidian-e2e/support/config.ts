export const PLUGIN_ID = "cbcr-text-eater-de";

export const TIMEOUT_DEFAULT_MS = 1000;
export const INTERVAL_DEFAULT_MS = 100;
export const MAX_ATTEMPTS_DEFAULT = 3;

/** Time to wait for plugin init + initial healing before each test */
export const INIT_HEALING_WAIT_MS = 0;
export const EXTRA_INIT_HEALING_WAIT_MS = 0;

// Offsets (keep if you still want per-action tuning)
export const OFFSET_AFTER_FILE_DELETION = { intervalOffset: 0, timeoutOffset: 0 };
export const OFFSET_AFTER_HEAL = { intervalOffset: 0, timeoutOffset: 0 };