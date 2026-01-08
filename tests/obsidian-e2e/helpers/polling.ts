import { browser } from "@wdio/globals";

export interface PollOptions {
	timeoutOffset?: number;
	intervalOffset?: number;
}

const TIMEOUT_DEFAULT = 2000;
const INTERVAL_DEFAULT = 500;

/** Time to wait for plugin init + initial healing before each test */
export const INIT_HEALING_WAIT_MS = 1000;
export const EXTRA_INIT_HEALING_WAIT_MS = 5000;

// Offsets
export const OFFSET_AFTER_FILE_DELETION = { intervalOffset: -400, timeoutOffset: 0, };
export const OFFSET_AFTER_HEAL = { intervalOffset: 1500, timeoutOffset: 1000 };

/**
 * Poll until file exists at path.
 */
export async function waitForFile(
	path: string,
	opts: PollOptions = {},
): Promise<boolean> {
	const { timeoutOffset = 0, intervalOffset = 0 } = opts;
	const start = Date.now();

	const timeout = TIMEOUT_DEFAULT + timeoutOffset;
	const interval = INTERVAL_DEFAULT + intervalOffset;

	while (Date.now() - start < timeout) {
		const exists = await browser.executeObsidian(
			async ({ app }, p) => !!app.vault.getAbstractFileByPath(p),
			path,
		);
		if (exists) return true;
		await new Promise((r) => setTimeout(r, interval));
	}
	return false;
}

/**
 * Poll until file does NOT exist at path.
 */
export async function waitForFileGone(
	path: string,
	opts: PollOptions = {},
): Promise<boolean> {
	const { timeoutOffset = 0, intervalOffset = 0 } = opts;
	const start = Date.now();

	const timeout = TIMEOUT_DEFAULT + timeoutOffset;
	const interval = INTERVAL_DEFAULT + intervalOffset;


	while (Date.now() - start < timeout) {
		const exists = await browser.executeObsidian(
			async ({ app }, p) => !!app.vault.getAbstractFileByPath(p),
			path,
		);
		if (!exists) return true;
		await new Promise((r) => setTimeout(r, interval));
	}
	return false;
}

/**
 * Poll until condition returns true.
 */
export async function waitFor<T>(
	fn: () => Promise<T>,
	predicate: (v: T) => boolean,
	opts: PollOptions = {},
): Promise<T | null> {
	const { timeoutOffset = 0, intervalOffset = 0 } = opts;
	const start = Date.now();

	const timeout = TIMEOUT_DEFAULT + timeoutOffset;
	const interval = INTERVAL_DEFAULT + intervalOffset;


	while (Date.now() - start < timeout) {
		const value = await fn();
		if (predicate(value)) return value;
		await new Promise((r) => setTimeout(r, interval));
	}
	return null;
}

