import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { HarnessError } from "./errors";

interface ManagedVaultRegistrationOptions {
	readonly now?: () => number;
	readonly registryPath?: string;
	readonly vaultId?: string;
	readonly vaultPath: string;
}

export interface ManagedVaultRegistration {
	readonly launchUri: string;
	readonly unregister: () => Promise<void>;
	readonly vaultId: string;
}

interface VaultRegistry {
	readonly [key: string]: unknown;
	readonly vaults: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRegistry(raw: string, registryPath: string): VaultRegistry {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch (cause) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Obsidian vault registry is not valid JSON: ${registryPath}`,
			{ cause },
		);
	}
	if (!isRecord(value) || !isRecord(value.vaults)) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Obsidian vault registry has no vault map: ${registryPath}`,
		);
	}
	return value as VaultRegistry;
}

function entryPath(value: unknown): string | undefined {
	return isRecord(value) && typeof value.path === "string"
		? resolve(value.path)
		: undefined;
}

async function updateRegistry(
	registryPath: string,
	update: (registry: VaultRegistry) => boolean,
): Promise<void> {
	const before = await readFile(registryPath, "utf8");
	const registry = parseRegistry(before, registryPath);
	if (!update(registry)) return;

	const registryStat = await stat(registryPath);
	const temporaryPath = resolve(
		dirname(registryPath),
		`.obsidian.json.textfresser-${randomUUID()}.tmp`,
	);
	try {
		await writeFile(temporaryPath, JSON.stringify(registry), {
			encoding: "utf8",
			mode: registryStat.mode,
		});
		if ((await readFile(registryPath, "utf8")) !== before) {
			throw new HarnessError(
				"HOST_BUSY",
				"Obsidian vault registry changed during managed E2E setup",
			);
		}
		await rename(temporaryPath, registryPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

function managedVaultRegistryPath(): string {
	return resolve(homedir(), "Library/Application Support/obsidian/obsidian.json");
}

function managedVaultId(vaultPath: string): string {
	return createHash("sha256").update(resolve(vaultPath)).digest("hex").slice(0, 16);
}

export async function findRegisteredVaultId(
	vaultPath: string,
	registryPath = managedVaultRegistryPath(),
): Promise<string> {
	const absoluteVaultPath = resolve(vaultPath);
	const registry = parseRegistry(
		await readFile(resolve(registryPath), "utf8"),
		resolve(registryPath),
	);
	const matches = Object.entries(registry.vaults).flatMap(([vaultId, entry]) =>
		entryPath(entry) === absoluteVaultPath ? [vaultId] : [],
	);
	if (matches.length === 0) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Attached E2E vault ${absoluteVaultPath} is not registered in Obsidian; open that folder as a vault once before running the harness`,
		);
	}
	if (matches.length > 1) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Attached E2E vault ${absoluteVaultPath} has multiple Obsidian vault IDs`,
		);
	}
	return matches[0] as string;
}

export async function registerManagedVault(
	options: ManagedVaultRegistrationOptions,
): Promise<ManagedVaultRegistration> {
	const registryPath = resolve(options.registryPath ?? managedVaultRegistryPath());
	const vaultPath = resolve(options.vaultPath);
	const vaultId = options.vaultId ?? managedVaultId(vaultPath);
	if (!/^[a-f0-9]{16}$/u.test(vaultId)) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Managed vault ID must be 16 lowercase hexadecimal characters: ${vaultId}`,
		);
	}

	await updateRegistry(registryPath, (registry) => {
		const existingPath = entryPath(registry.vaults[vaultId]);
		if (existingPath && existingPath !== vaultPath) {
			throw new HarnessError(
				"SESSION_INVALID",
				`Managed vault ID ${vaultId} already belongs to another vault`,
			);
		}
		registry.vaults[vaultId] = {
			path: vaultPath,
			ts: (options.now ?? Date.now)(),
		};
		return true;
	});

	let registered = true;
	return {
		launchUri: `obsidian://open?vault=${encodeURIComponent(vaultId)}`,
		async unregister() {
			if (!registered) return;
			await updateRegistry(registryPath, (registry) => {
				const existing = registry.vaults[vaultId];
				if (existing === undefined) return false;
				if (entryPath(existing) !== vaultPath) {
					throw new HarnessError(
						"SESSION_INVALID",
						`Managed vault ID ${vaultId} changed ownership during the E2E run`,
					);
				}
				delete registry.vaults[vaultId];
				return true;
			});
			registered = false;
		},
		vaultId,
	};
}
