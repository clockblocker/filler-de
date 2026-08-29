import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { waitForIdle } from "./utils";
import { obsidian, obsidianEval } from "./utils/cli";

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
function copyIfChanged(source: string, destination: string): boolean {
	if (
		existsSync(destination) &&
		readFileSync(source).equals(readFileSync(destination))
	) {
		return false;
	}
	copyFileSync(source, destination);
	return true;
}

function deployBuildArtifacts(): boolean {
	const vaultPath = getVaultPath();
	const pluginDir = resolve(vaultPath, ".obsidian/plugins", PLUGIN_ID);

	const mainJs = resolve(PROJECT_ROOT, "main.js");
	const manifest = resolve(PROJECT_ROOT, "manifest.json");

	if (!existsSync(mainJs)) {
		throw new Error(
			`main.js not found at ${mainJs}. Run 'bun run build' first.`,
		);
	}

	const mainChanged = copyIfChanged(mainJs, resolve(pluginDir, "main.js"));
	const manifestChanged = copyIfChanged(
		manifest,
		resolve(pluginDir, "manifest.json"),
	);
	return mainChanged || manifestChanged;
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

async function disablePluginWhileSeeding(): Promise<void> {
	const loaded = await obsidianEval(
		`app.plugins.plugins['${PLUGIN_ID}'] ? 'yes' : 'no'`,
	);
	if (loaded !== "yes") return;

	// Finish the current instance's work before unloading it. Seeding while a
	// listener is active can split the fixture into multiple healing windows.
	await waitForIdle(20_000);
	await obsidian(`plugin:disable id=${PLUGIN_ID}`);
	await obsidianEval(
		`(async()=>{const startedAt=Date.now();while(app.plugins.plugins['${PLUGIN_ID}']){if(Date.now()-startedAt>10000)throw new Error('Plugin disable timed out');await new Promise(resolve=>setTimeout(resolve,100));}return 'disabled'})()`,
		12_000,
	);
}

async function clearFixtureRoots(): Promise<void> {
	const vaultPath = getVaultPath();
	for (const root of ["Library", "Outside"] as const) {
		rmSync(resolve(vaultPath, root), { force: true, recursive: true });
	}

	await obsidianEval(
		`(async()=>{const roots=['Library','Outside'];let stable=0;for(let attempt=0;attempt<100;attempt++){await new Promise(resolve=>setTimeout(resolve,100));const indexIsClean=roots.every(path=>!app.vault.getAbstractFileByPath(path));const adapterIsClean=(await Promise.all(roots.map(path=>app.vault.adapter.exists(path)))).every(exists=>!exists);if(indexIsClean&&adapterIsClean){stable++;if(stable>=10)return 'clean'}else{stable=0}}throw new Error('Fixture roots did not stay deleted in the index and adapter')})()`,
		12_000,
	);
}

function seedFixtureFiles(): void {
	const vaultPath = getVaultPath();
	for (const fixture of FIXTURE_FILES) {
		const absolutePath = resolve(vaultPath, fixture.path);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, fixture.content, "utf8");
	}
}

async function waitForFixtureIndex(): Promise<void> {
	const paths = JSON.stringify(FIXTURE_FILES.map(({ path }) => path));
	await obsidianEval(
		`(async()=>{const paths=${paths};const startedAt=Date.now();while(!paths.every(path=>app.vault.getAbstractFileByPath(path))){if(Date.now()-startedAt>10000)throw new Error('Fixture indexing timed out');await new Promise(resolve=>setTimeout(resolve,100))}return 'indexed'})()`,
		12_000,
	);
}

async function enablePluginAndWaitUntilInitialized(): Promise<void> {
	await obsidianEval(
		"(()=>{window.__E2E_MODE=true;return 'e2e-enabled'})()",
	);
	await obsidian(`plugin:enable id=${PLUGIN_ID}`);
	await obsidianEval(
		`(async()=>{const startedAt=Date.now();let candidate=null;let stableSince=0;while(true){const plugin=app.plugins.plugins['${PLUGIN_ID}'];if(plugin?.initialized&&plugin===candidate){if(Date.now()-stableSince>=1000)return 'ready'}else{candidate=plugin?.initialized?plugin:null;stableSince=Date.now()}if(Date.now()-startedAt>20000)throw new Error('Plugin initialization timed out');await new Promise(resolve=>setTimeout(resolve,100));}})()`,
		22_000,
	);
}

/**
 * Set up the test vault:
 * 1. Ensure vault is open in Obsidian
 * 2. Wait for and disable the currently loaded plugin
 * 3. Deploy build artifacts (main.js, manifest.json)
 * 4. Clean Library/ and Outside/ while no listener is active
 * 5. Create fixture files
 * 6. Enable the deployed plugin and wait for healing
 */
export async function setupTestVault(): Promise<void> {
	// Ensure vault is open in Obsidian
	await ensureVaultOpen();

	await disablePluginWhileSeeding();

	// Copying main.js while the plugin is active schedules an additional
	// file-watcher reload after the explicit lifecycle below has completed.
	const buildChanged = deployBuildArtifacts();
	if (buildChanged) {
		// Obsidian debounces plugin-file changes for several seconds. Keep the
		// plugin disabled until that watcher cycle has definitively elapsed.
		await new Promise((resolve) => setTimeout(resolve, 6_000));
	}

	// Clean up any leftover state and wait for Obsidian's index to agree before
	// recreating paths with the same names.
	await clearFixtureRoots();

	// Seed fixture files while the plugin is disabled, then wait for Obsidian's
	// index before enabling listeners that heal them.
	seedFixtureFiles();
	await waitForFixtureIndex();

	// Enable the deployed build so it discovers the fixture from scratch.
	await enablePluginAndWaitUntilInitialized();

	// Wait for initial healing to complete
	await waitForIdle();
}
