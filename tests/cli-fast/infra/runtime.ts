import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { obsidian } from "../../cli-e2e/utils/cli";

const PLUGIN_ID = "cbcr-text-eater-de";
const PROJECT_ROOT = resolve(import.meta.dir, "../../..");

const WAIT_LEVEL_MS = {
	long: 2000,
	medium: 500,
	"medium-long": 1000,
	short: 100,
} as const;

export type FastWaitLevel = keyof typeof WAIT_LEVEL_MS;

function getVaultPath(): string {
	const vaultPath = process.env.CLI_E2E_VAULT_PATH;
	if (!vaultPath) {
		throw new Error(
			"CLI_E2E_VAULT_PATH env var is required (absolute path to the test vault folder)",
		);
	}
	return vaultPath;
}

function getVaultName(): string {
	const vaultName = process.env.CLI_E2E_VAULT;
	if (!vaultName) {
		throw new Error(
			"CLI_E2E_VAULT env var is required (Obsidian vault name for CLI commands)",
		);
	}
	return vaultName;
}

export function deployLatestBuild(): void {
	const vaultPath = getVaultPath();
	const pluginDir = resolve(vaultPath, ".obsidian/plugins", PLUGIN_ID);

	const mainJs = resolve(PROJECT_ROOT, "main.js");
	const manifest = resolve(PROJECT_ROOT, "manifest.json");

	if (!existsSync(mainJs)) {
		throw new Error(
			`main.js not found at ${mainJs}. Run 'bun run build' first.`,
		);
	}

	copyFileSync(mainJs, resolve(pluginDir, "main.js"));
	copyFileSync(manifest, resolve(pluginDir, "manifest.json"));
}

export async function ensureVaultOpenFast(): Promise<void> {
	try {
		await obsidian("files total");
		return;
	} catch {
		const vaultName = getVaultName();
		const proc = Bun.spawn([
			"open",
			`obsidian://open?vault=${encodeURIComponent(vaultName)}`,
		]);
		await proc.exited;

		const start = Date.now();
		while (Date.now() - start < 10_000) {
			await Bun.sleep(300);
			try {
				await obsidian("files total");
				return;
			} catch {
				// Keep waiting for the vault to become available.
			}
		}

		throw new Error(
			`Timed out waiting for vault "${vaultName}" to become available via CLI`,
		);
	}
}

export async function reloadPluginFast(): Promise<void> {
	await obsidian(`plugin:reload id=${PLUGIN_ID}`);
}

export async function waitFor(level: FastWaitLevel): Promise<void> {
	await Bun.sleep(WAIT_LEVEL_MS[level]);
}

export async function prepareFastSuite(): Promise<void> {
	deployLatestBuild();
	await ensureVaultOpenFast();
	await reloadPluginFast();
	await waitFor("short");
}
