import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { resolveArtifactSources } from "./infra/artifacts";
import { resolveOfficialCli } from "./infra/cli";
import { captureFailureDiagnostics, prepareDiagnostics } from "./infra/diagnostics";
import { awaitDriverReady } from "./infra/driver";
import { describeError, HarnessError } from "./infra/errors";
import { type HostDescription, prepareAttachedHost, prepareManagedHost } from "./infra/host";
import { acquireHarnessLock } from "./infra/lock";
import { runProcess } from "./infra/process";
import {
	createSessionManifest,
	type SessionMode,
	sessionEnvironment,
	writeSessionManifest,
} from "./infra/session";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const SCENARIO_DIR = resolve(import.meta.dir, "scenarios");

function selectMode(): SessionMode {
	const explicit = process.argv.find((arg) => arg.startsWith("--mode="))?.slice(7) ??
		process.env.OBSIDIAN_E2E_MODE;
	if (explicit === "attached" || explicit === "managed") return explicit;
	if (explicit) {
		throw new HarnessError(
			"SESSION_INVALID",
			`Unknown mode ${explicit}; expected attached or managed`,
		);
	}
	return process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH
		? "attached"
		: "managed";
}

async function main(): Promise<void> {
	const mode = selectMode();
	const lock = await acquireHarnessLock();
	let host: HostDescription | undefined;
	let artifactDir: string | undefined;
	let failed = false;
	try {
		const cliPath = await resolveOfficialCli();
		const sources = await resolveArtifactSources(PROJECT_ROOT);
		const sessionId = randomUUID();
		artifactDir = resolve(
			process.env.OBSIDIAN_E2E_ARTIFACT_DIR ??
				resolve(tmpdir(), `textfresser-obsidian-e2e-${sessionId}`),
		);
		await mkdir(artifactDir, { recursive: true });
		host =
			mode === "attached"
				? await prepareAttachedHost({ cliPath, sessionId, sources })
				: await prepareManagedHost({ cliPath, sessionId, sources });
		const manifest = createSessionManifest({
			artifactDir,
			cliPath,
			mode,
			sessionId,
			vaultName: host.vaultName,
			vaultPath: host.vaultPath,
		});
		const manifestPath = await writeSessionManifest(manifest);
		await prepareDiagnostics(host.cli);
		await awaitDriverReady(host.cli, sessionId);

		const result = await runProcess(
			process.execPath,
			[
				"test",
				SCENARIO_DIR,
				"--timeout",
				"240000",
				"--parallel=1",
				"--max-concurrency=1",
			],
			{
				cwd: PROJECT_ROOT,
				env: sessionEnvironment(manifest, manifestPath),
				inherit: true,
				timeoutMs: 20 * 60_000,
			},
		);
		if (result.exitCode !== 0) {
			throw new HarnessError(
				"PROCESS_FAILED",
				`Obsidian E2E scenarios exited with ${result.exitCode}`,
				{ command: process.execPath, exitCode: result.exitCode },
			);
		}
	} catch (error) {
		failed = true;
		if (host && artifactDir) {
			await captureFailureDiagnostics(host.cli, artifactDir).catch(() => undefined);
		}
		throw error;
	} finally {
		await host?.cleanup().catch((error) => {
			if (!failed) throw error;
		});
		await lock.release();
	}
}

await main().catch((error) => {
	process.stderr.write(`${describeError(error)}\n`);
	process.exitCode = 1;
});
