import { obsidian, obsidianEval } from "./cli";

const PLUGIN_ID = "cbcr-text-eater-de";

/**
 * Wait for the plugin to finish all async work via its `whenIdle()` hook.
 * Uses the CLI `eval` command to call into the running Obsidian instance.
 */
export async function waitForIdle(timeoutMs = 5_000): Promise<void> {
	const code = `(async()=>{await app.plugins.plugins['${PLUGIN_ID}'].whenIdle();return 'idle'})()`;
	await obsidianEval(code, timeoutMs);
}

/**
 * Reload the plugin via CLI.
 */
export async function reloadPlugin(): Promise<void> {
	await obsidian(`plugin:reload id=${PLUGIN_ID}`);
}
