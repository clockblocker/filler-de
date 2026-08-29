import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { HarnessError } from "./errors";

export const TEXTFRESSER_PLUGIN_ID = "cbcr-text-eater-de";

interface PluginManifest {
	readonly id: string;
	readonly name?: string;
	readonly version?: string;
}

export interface ArtifactSources {
	readonly driverDir: string;
	readonly driverId: string;
	readonly textfresserDir: string;
	readonly textfresserId: typeof TEXTFRESSER_PLUGIN_ID;
}

async function readManifest(directory: string): Promise<PluginManifest> {
	const path = resolve(directory, "manifest.json");
	try {
		const manifest = JSON.parse(await readFile(path, "utf8")) as PluginManifest;
		if (!manifest.id?.trim()) throw new Error("manifest.id is missing");
		await readFile(resolve(directory, "main.js"));
		return manifest;
	} catch (cause) {
		throw new HarnessError(
			"ARTIFACT_INVALID",
			`Plugin artifact ${directory} must contain valid manifest.json and main.js`,
			{ cause },
		);
	}
}

export async function resolveArtifactSources(
	projectRoot: string,
): Promise<ArtifactSources> {
	const driverDir = resolve(
		process.env.OBSIDIAN_E2E_DRIVER_DIR ??
			resolve(projectRoot, "tests/obsidian-e2e/driver/dist"),
	);
	const driver = await readManifest(driverDir);
	const textfresser = await readManifest(projectRoot);

	if (textfresser.id !== TEXTFRESSER_PLUGIN_ID) {
		throw new HarnessError(
			"ARTIFACT_INVALID",
			`Expected Textfresser manifest id ${TEXTFRESSER_PLUGIN_ID}, got ${textfresser.id}`,
		);
	}
	if (driver.id === TEXTFRESSER_PLUGIN_ID) {
		throw new HarnessError(
			"ARTIFACT_INVALID",
			"The E2E driver must have a distinct plugin id",
		);
	}

	return {
		driverDir,
		driverId: driver.id,
		textfresserDir: projectRoot,
		textfresserId: TEXTFRESSER_PLUGIN_ID,
	};
}

async function deployDirectory(source: string, destination: string): Promise<void> {
	await rm(destination, { force: true, recursive: true });
	await mkdir(destination, { recursive: true });
	await Promise.all(
		["main.js", "manifest.json", "styles.css"].map(async (file) => {
			try {
				await cp(resolve(source, file), resolve(destination, file));
			} catch (cause) {
				if (
					file !== "styles.css" ||
					(cause as NodeJS.ErrnoException).code !== "ENOENT"
				) {
					throw cause;
				}
			}
		}),
	);
}

export async function deployPlugins(options: {
	readonly sessionId: string;
	readonly sources: ArtifactSources;
	readonly vaultPath: string;
}): Promise<void> {
	const pluginRoot = resolve(options.vaultPath, ".obsidian/plugins");
	await mkdir(pluginRoot, { recursive: true });
	const driverDestination = resolve(pluginRoot, options.sources.driverId);
	const textfresserDestination = resolve(
		pluginRoot,
		options.sources.textfresserId,
	);
	try {
		await deployDirectory(options.sources.driverDir, driverDestination);
		await writeFile(
			resolve(driverDestination, "data.json"),
			`${JSON.stringify({ protocol: 1, sessionId: options.sessionId }, null, 2)}\n`,
			"utf8",
		);
		await deployDirectory(options.sources.textfresserDir, textfresserDestination);
	} catch (cause) {
		throw new HarnessError(
			"ARTIFACT_INVALID",
			`Failed to deploy plugins into ${basename(options.vaultPath)}`,
			{ cause },
		);
	}
}
