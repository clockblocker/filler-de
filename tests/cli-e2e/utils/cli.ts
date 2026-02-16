import type { CliResult } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

/** Noise lines emitted by the CLI that we strip from stderr. */
const STDERR_NOISE = ["Loading updated app package"];

export class CliError extends Error {
	constructor(
		public readonly command: string,
		public readonly result: CliResult,
	) {
		super(
			`CLI command failed (exit ${result.exitCode}): ${command}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
		);
		this.name = "CliError";
	}
}

function getVaultName(): string {
	return process.env.CLI_E2E_VAULT ?? "cli-e2e-test";
}

function stripNoise(stderr: string): string {
	return stderr
		.split("\n")
		.filter((line) => !STDERR_NOISE.some((noise) => line.includes(noise)))
		.join("\n")
		.trim();
}

/**
 * Runs an Obsidian CLI command against the configured vault.
 *
 * @param command - Full command string after `obsidian`, e.g. `create name=Foo content=Bar silent`
 * @param timeoutMs - Timeout in milliseconds (default 10s)
 */
export async function obsidian(
	command: string,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CliResult> {
	const vaultName = getVaultName();
	const fullCommand = `obsidian vault="${vaultName}" ${command}`;

	const proc = Bun.spawn(["sh", "-c", fullCommand], {
		stderr: "pipe",
		stdout: "pipe",
	});

	const timer = setTimeout(() => {
		proc.kill();
	}, timeoutMs);

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;
	clearTimeout(timer);

	const result: CliResult = {
		exitCode,
		stderr: stripNoise(stderr),
		stdout: stdout.trim(),
	};

	if (exitCode !== 0) {
		throw new CliError(fullCommand, result);
	}

	return result;
}
