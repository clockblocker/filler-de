import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { HarnessError } from "./errors";

export const SESSION_PROTOCOL_VERSION = 1 as const;
export const DRIVER_COMMAND = "textfresser-e2e";

export type SessionMode = "attached" | "managed";

export interface ObsidianE2eSessionManifest {
	readonly artifactDir: string;
	readonly cliPath: string;
	readonly driverCommand: typeof DRIVER_COMMAND;
	readonly mode: SessionMode;
	readonly protocolVersion: typeof SESSION_PROTOCOL_VERSION;
	readonly sessionId: string;
	readonly startedAt: string;
	readonly vaultName: string;
	readonly vaultPath: string;
}

interface CreateSessionManifestOptions {
	readonly artifactDir: string;
	readonly cliPath: string;
	readonly mode: SessionMode;
	readonly sessionId?: string;
	readonly vaultName: string;
	readonly vaultPath: string;
}

function requireAbsolute(label: string, value: string): string {
	if (!isAbsolute(value)) {
		throw new HarnessError("SESSION_INVALID", `${label} must be absolute: ${value}`);
	}
	return resolve(value);
}

export function createSessionManifest(
	options: CreateSessionManifestOptions,
): ObsidianE2eSessionManifest {
	if (!options.vaultName.trim()) {
		throw new HarnessError("SESSION_INVALID", "Vault name must not be empty");
	}
	return {
		artifactDir: requireAbsolute("artifactDir", options.artifactDir),
		cliPath: requireAbsolute("cliPath", options.cliPath),
		driverCommand: DRIVER_COMMAND,
		mode: options.mode,
		protocolVersion: SESSION_PROTOCOL_VERSION,
		sessionId: options.sessionId ?? randomUUID(),
		startedAt: new Date().toISOString(),
		vaultName: options.vaultName,
		vaultPath: requireAbsolute("vaultPath", options.vaultPath),
	};
}

export async function writeSessionManifest(
	manifest: ObsidianE2eSessionManifest,
): Promise<string> {
	await mkdir(manifest.artifactDir, { recursive: true });
	const path = resolve(manifest.artifactDir, "session.json");
	await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
		encoding: "utf8",
		flag: "wx",
	});
	return path;
}

export function sessionEnvironment(
	manifest: ObsidianE2eSessionManifest,
	manifestPath: string,
): NodeJS.ProcessEnv {
	return {
		...process.env,
		OBSIDIAN_CLI_PATH: manifest.cliPath,
		OBSIDIAN_E2E_ARTIFACT_DIR: manifest.artifactDir,
		OBSIDIAN_E2E_CLI_PATH: manifest.cliPath,
		OBSIDIAN_E2E_DRIVER_COMMAND: manifest.driverCommand,
		OBSIDIAN_E2E_SESSION_ID: manifest.sessionId,
		OBSIDIAN_E2E_SESSION_MANIFEST: manifestPath,
		OBSIDIAN_E2E_VAULT: manifest.vaultName,
		OBSIDIAN_E2E_VAULT_PATH: manifest.vaultPath,
	};
}
