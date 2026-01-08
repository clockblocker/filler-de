import { browser } from "@wdio/globals";

export interface PollOptions {
	timeout?: number;
	interval?: number;
}

const DEFAULT_TIMEOUT = 3000;
const DEFAULT_INTERVAL = 1000;

/** Time to wait for plugin init + initial healing before each test */
export const INIT_HEALING_WAIT_MS = 1000;

/**
 * Poll until file exists at path.
 */
export async function waitForFile(
	path: string,
	opts: PollOptions = {},
): Promise<boolean> {
	const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = opts;
	const start = Date.now();

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
	const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = opts;
	const start = Date.now();

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
	const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL } = opts;
	const start = Date.now();

	while (Date.now() - start < timeout) {
		const value = await fn();
		if (predicate(value)) return value;
		await new Promise((r) => setTimeout(r, interval));
	}
	return null;
}

