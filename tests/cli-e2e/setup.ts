import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createFiles, deleteAllUnder, reloadPlugin, waitForIdle } from "./utils";
import { obsidian } from "./utils/cli";

const PLUGIN_ID = "cbcr-text-eater-de";

/** Project root — two levels up from tests/cli-e2e/ */
const PROJECT_ROOT = resolve(import.meta.dir, "../..");

function getVaultPath(): string {
	const p = process.env.CLI_E2E_VAULT_PATH;
	if (!p) {
		throw new Error(
			"CLI_E2E_VAULT_PATH env var is required (absolute path to the test vault folder)",
		);
	}
	return p;
}

/**
 * Fixture data: the initial vault structure matching librarian-chain-0.
 * These files are created via CLI before tests run.
 */
const FIXTURE_FILES: readonly { content: string; path: string }[] = [
	{ content: "# Ingredients", path: "Library/Recipe/Pie/Ingredients.md" },
	{ content: "# Steps", path: "Library/Recipe/Pie/Steps.md" },
	{ content: "", path: "Library/Recipe/Pie/Result_picture.jpg" },
	{ content: "# Ingredients", path: "Library/Recipe/Soup/Pho_Bo/Ingredients.md" },
	{ content: "# Steps", path: "Library/Recipe/Soup/Pho_Bo/Steps.md" },
	{ content: "", path: "Library/Recipe/Soup/Pho_Bo/Result_picture.jpg" },
	{ content: "", path: "Outside/Avatar-S1-E1.md" },
];

/**
 * Step 0: Deploy latest build artifacts to the test vault's plugin directory.
 */
function deployBuildArtifacts(): void {
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

/**
 * Ensure Obsidian has the vault open. Try a health-check CLI call;
 * if it fails, open via URI scheme and retry.
 */
async function ensureVaultOpen(): Promise<void> {
	try {
		await obsidian("files");
		return; // vault is already open
	} catch {
		// Vault not open — open it via URI scheme
		const vaultName = process.env.CLI_E2E_VAULT;
		if (!vaultName) {
			throw new Error("CLI_E2E_VAULT env var is required");
		}
		const proc = Bun.spawn([
			"open",
			`obsidian://open?vault=${encodeURIComponent(vaultName)}`,
		]);
		await proc.exited;

		// Wait for Obsidian to load the vault
		const maxWait = 10_000;
		const interval = 500;
		const start = Date.now();
		while (Date.now() - start < maxWait) {
			await new Promise((r) => setTimeout(r, interval));
			try {
				await obsidian("files");
				return;
			} catch {
				// keep waiting
			}
		}
		throw new Error(
			`Timed out waiting for vault "${vaultName}" to become available via CLI`,
		);
	}
}

/**
 * Set up the test vault:
 * 1. Deploy build artifacts (main.js, manifest.json)
 * 2. Ensure vault is open in Obsidian
 * 3. Reload plugin with new code
 * 4. Clean Library/ and Outside/
 * 5. Create fixture files
 * 6. Reload plugin again and wait for healing
 */
export async function setupTestVault(): Promise<void> {
	// Step 0: deploy latest build
	deployBuildArtifacts();

	// Ensure vault is open in Obsidian
	await ensureVaultOpen();

	// Reload plugin to pick up new main.js
	await reloadPlugin();
	await waitForIdle();

	// Clean up any leftover state
	await deleteAllUnder("Library");
	await deleteAllUnder("Outside");

	// Create fixture files
	await createFiles(FIXTURE_FILES);

	// Reload plugin so it discovers the new vault state from scratch
	await reloadPlugin();

	// Wait for initial healing to complete
	await waitForIdle();
}
