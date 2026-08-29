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
	await obsidianEval(
		`(()=>{window.__E2E_PREVIOUS_PLUGIN_INSTANCE=app.plugins.plugins['${PLUGIN_ID}'];return 'marked'})()`,
	);
	await obsidian(`plugin:reload id=${PLUGIN_ID}`);
	await obsidianEval(
		`(async()=>{const startedAt=Date.now();let candidate=null;let stableSince=0;while(true){const plugin=app.plugins.plugins['${PLUGIN_ID}'];if(plugin&&plugin!==window.__E2E_PREVIOUS_PLUGIN_INSTANCE&&plugin.initialized){if(plugin===candidate){if(Date.now()-stableSince>=1000)return 'ready'}else{candidate=plugin;stableSince=Date.now()}}else{candidate=null;stableSince=Date.now()}if(Date.now()-startedAt>20000)throw new Error('Plugin reload timed out');await new Promise(resolve=>setTimeout(resolve,100));}})()`,
		22_000,
	);
}
