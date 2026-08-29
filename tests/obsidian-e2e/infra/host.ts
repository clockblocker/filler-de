import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import type { ArtifactSources } from "./artifacts";
import { deployPlugins } from "./artifacts";
import { ObsidianCli } from "./cli";
import { HarnessError } from "./errors";
import { runProcess } from "./process";

export interface HostDescription {
	readonly cleanup: () => Promise<void>;
	readonly cli: ObsidianCli;
	readonly vaultName: string;
	readonly vaultPath: string;
}

async function runningObsidianPids(): Promise<readonly number[]> {
	const result = await runProcess("/usr/bin/pgrep", ["-x", "Obsidian"], {
		timeoutMs: 3_000,
	});
	if (result.exitCode === 1) return [];
	if (result.exitCode !== 0) {
		throw new HarnessError(
			"PROCESS_FAILED",
			"Could not determine whether Obsidian is running",
			{ command: "/usr/bin/pgrep", ...result },
		);
	}
	return result.stdout
		.split(/\s+/u)
		.map(Number)
		.filter((pid) => Number.isSafeInteger(pid) && pid > 0);
}

async function waitForVault(
	cli: ObsidianCli,
	expectedPath: string,
	timeoutMs = 45_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			const result = await cli.call(["vault", "info=path"], { timeoutMs: 4_000 });
			if (resolve(result.stdout.replace(/^=>\s*/u, "")) === resolve(expectedPath)) {
				return;
			}
			lastError = new Error(`CLI routed to ${result.stdout}, expected ${expectedPath}`);
		} catch (error) {
			lastError = error;
		}
		await Bun.sleep(400);
	}
	throw new HarnessError(
		"SESSION_INVALID",
		`Timed out waiting for Obsidian vault ${expectedPath}`,
		{ cause: lastError },
	);
}

export async function prepareAttachedHost(options: {
	readonly cliPath: string;
	readonly sessionId: string;
	readonly sources: ArtifactSources;
}): Promise<HostDescription> {
	const vaultName = process.env.CLI_E2E_VAULT?.trim();
	const vaultPath = process.env.CLI_E2E_VAULT_PATH?.trim();
	if (!vaultName || !vaultPath) {
		throw new HarnessError(
			"SESSION_INVALID",
			"Attached mode requires CLI_E2E_VAULT and CLI_E2E_VAULT_PATH",
		);
	}
	const absoluteVaultPath = resolve(vaultPath);
	const cli = new ObsidianCli({ cliPath: options.cliPath, vaultName });
	await waitForVault(cli, absoluteVaultPath);

	// Deployment is a session boundary: both plugins are disabled while their files
	// are replaced, and are enabled in dependency order exactly once afterwards.
	await cli
		.call(["plugin:disable", `id=${options.sources.textfresserId}`], {
			allowErrorText: true,
		})
		.catch(() => undefined);
	const enabledAfterDisable = await cli.json<unknown>([
		"plugins:enabled",
		"format=json",
	]);
	if (enabledPluginIds(enabledAfterDisable).includes(options.sources.textfresserId)) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Textfresser ${options.sources.textfresserId} remained enabled; refusing to deploy into a live plugin`,
		);
	}
	await cli
		.call(["plugin:disable", `id=${options.sources.driverId}`], {
			allowErrorText: true,
		})
		.catch(() => undefined);
	await deployPlugins({
		sessionId: options.sessionId,
		sources: options.sources,
		vaultPath: absoluteVaultPath,
	});
	await cli.call(["plugin:enable", `id=${options.sources.driverId}`]);
	await cli.call(["plugin:enable", `id=${options.sources.textfresserId}`]);

	return {
		cleanup: async () => undefined,
		cli,
		vaultName,
		vaultPath: absoluteVaultPath,
	};
}

function enabledPluginIds(value: unknown): readonly string[] {
	if (
		value &&
		typeof value === "object" &&
		"plugins" in value
	) {
		return enabledPluginIds((value as { plugins?: unknown }).plugins);
	}
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (typeof entry === "string") return [entry];
		if (entry && typeof entry === "object" && "id" in entry) {
			const id = (entry as { id?: unknown }).id;
			return typeof id === "string" ? [id] : [];
		}
		return [];
	});
}

async function restoreVaultTemplate(vaultPath: string): Promise<void> {
	const configured = process.env.OBSIDIAN_E2E_VAULT_TEMPLATE;
	const template = configured ? resolve(configured) : undefined;
	if (template) {
		await access(template);
		await cp(template, vaultPath, { recursive: true });
	}
	await mkdir(resolve(vaultPath, ".obsidian"), { recursive: true });
	try {
		await readFile(resolve(vaultPath, ".obsidian/app.json"));
	} catch {
		await writeFile(resolve(vaultPath, ".obsidian/app.json"), "{}\n", "utf8");
	}
}

export async function prepareManagedHost(options: {
	readonly cliPath: string;
	readonly sessionId: string;
	readonly sources: ArtifactSources;
}): Promise<HostDescription> {
	if (process.platform !== "darwin") {
		throw new HarnessError(
			"SESSION_INVALID",
			"Managed Obsidian E2E mode currently requires macOS",
		);
	}
	const existingPids = await runningObsidianPids();
	if (existingPids.length > 0) {
		throw new HarnessError(
			"HOST_BUSY",
			`Managed mode will not take over a running Obsidian process (${existingPids.join(", ")}). Quit it or use attached mode.`,
		);
	}

	const vaultPath = await mkdtemp(
		resolve(tmpdir(), "textfresser-obsidian-e2e-vault-"),
	);
	const vaultName = basename(vaultPath);
	let ownedPids: readonly number[] = [];
	let launched = false;
	const cli = new ObsidianCli({ cliPath: options.cliPath, vaultName });
	try {
		await restoreVaultTemplate(vaultPath);
		await deployPlugins({
			sessionId: options.sessionId,
			sources: options.sources,
			vaultPath,
		});
		await writeFile(
			resolve(vaultPath, ".obsidian/community-plugins.json"),
			`${JSON.stringify([options.sources.driverId, options.sources.textfresserId], null, 2)}\n`,
			"utf8",
		);

		const opened = await runProcess(
			"/usr/bin/open",
			[`obsidian://open?path=${encodeURIComponent(vaultPath)}`],
			{ timeoutMs: 10_000 },
		);
		if (opened.exitCode !== 0) {
			throw new HarnessError("PROCESS_FAILED", "Could not launch Obsidian", {
				command: "/usr/bin/open",
				...opened,
			});
		}
		launched = true;
		const pidDeadline = Date.now() + 10_000;
		while (ownedPids.length === 0 && Date.now() < pidDeadline) {
			await Bun.sleep(200);
			ownedPids = await runningObsidianPids();
		}
		if (ownedPids.length === 0) {
			throw new HarnessError(
				"PROCESS_FAILED",
				"Obsidian launch returned without creating an app process",
			);
		}
		await waitForVault(cli, vaultPath);
	} catch (error) {
		if (launched) await quitOwnedObsidian(ownedPids);
		await rm(vaultPath, { force: true, recursive: true });
		throw error;
	}

	return {
		async cleanup() {
			await quitOwnedObsidian(ownedPids);
			if (process.env.OBSIDIAN_E2E_KEEP_VAULT !== "1") {
				await rm(vaultPath, { force: true, recursive: true });
			}
		},
		cli,
		vaultName,
		vaultPath,
	};
}

async function quitOwnedObsidian(ownedPids: readonly number[]): Promise<void> {
	if (ownedPids.length === 0) return;
	const currentPids = await runningObsidianPids();
	if (!ownedPids.some((pid) => currentPids.includes(pid))) return;
	await runProcess(
		"/usr/bin/osascript",
		["-e", 'tell application id "md.obsidian" to quit'],
		{ timeoutMs: 10_000 },
	).catch(() => undefined);
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		if (!(await runningObsidianPids()).some((pid) => ownedPids.includes(pid))) return;
		await Bun.sleep(200);
	}
}
