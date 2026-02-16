import type { CliResult } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

const OBSIDIAN_BIN =
	process.env.OBSIDIAN_CLI_PATH ??
	"/Applications/Obsidian.app/Contents/MacOS/Obsidian";

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
	const name = process.env.CLI_E2E_VAULT;
	if (!name) {
		throw new Error(
			"CLI_E2E_VAULT env var is required (Obsidian vault name for CLI commands)",
		);
	}
	return name;
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
	const fullCommand = `"${OBSIDIAN_BIN}" vault="${vaultName}" ${command}`;

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

/**
 * Run eval code directly via Bun.spawn (no shell) to avoid
 * zsh special character mangling (!, $, etc. inside double quotes).
 * Also detects eval errors (Obsidian CLI returns exit 0 even on eval failure).
 */
export async function obsidianEval(
	code: string,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
	const vaultName = getVaultName();

	const proc = Bun.spawn(
		[OBSIDIAN_BIN, `vault=${vaultName}`, "eval", `code=${code}`],
		{ stderr: "pipe", stdout: "pipe" },
	);

	const timer = setTimeout(() => {
		proc.kill();
	}, timeoutMs);

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	await proc.exited;
	clearTimeout(timer);

	// Without shell, the "Loading..." noise goes to stdout — strip it
	const meaningful = stdout
		.split("\n")
		.filter((line) => !STDERR_NOISE.some((noise) => line.includes(noise)))
		.join("\n")
		.trim();

	// Obsidian CLI eval returns exit 0 even on error — detect via output prefix
	if (meaningful.startsWith("Error:")) {
		throw new Error(`eval failed: ${meaningful}\ncode: ${code}`);
	}

	// Successful eval output is prefixed with "=> "
	return meaningful.replace(/^=> /, "");
}
