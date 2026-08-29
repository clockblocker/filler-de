import { randomUUID } from "node:crypto";
import type { CliResult } from "./types";

const DEFAULT_TIMEOUT_MS = 5_000;

const OBSIDIAN_BIN =
	process.env.OBSIDIAN_CLI_PATH ??
	"/Applications/Obsidian.app/Contents/MacOS/Obsidian";

/** Noise lines emitted by the CLI that we strip from command output streams. */
const CLI_NOISE_LINES = [
	"Loading updated app package",
	"Checking for updates",
];

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

export function stripCliNoise(text: string): string {
	return text
		.split("\n")
		.filter(
			(line) => !CLI_NOISE_LINES.some((noise) => line.includes(noise)),
		)
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
		stderr: stripCliNoise(stderr),
		stdout: stripCliNoise(stdout),
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
async function runEvalProcess(
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

	const exitCode = await proc.exited;
	clearTimeout(timer);

	// Without shell, "Loading..." noise may go to stdout — strip from both streams.
	const meaningful = stripCliNoise(stdout);
	const meaningfulStderr = stripCliNoise(stderr);

	// Obsidian CLI eval returns exit 0 even on error — detect via output prefix
	if (meaningful.startsWith("Error:")) {
		throw new Error(
			`eval failed: ${meaningful}\nstderr: ${meaningfulStderr}\ncode: ${code}`,
		);
	}
	if (exitCode !== 0) {
		throw new Error(
			`eval process failed with exit ${exitCode}: ${meaningfulStderr}\ncode: ${code}`,
		);
	}

	// Successful eval output is prefixed with "=> "
	return meaningful.replace(/^=> /, "");
}

type EvalState =
	| { readonly status: "pending" }
	| { readonly status: "fulfilled"; readonly value: string }
	| { readonly reason: string; readonly status: "rejected" };

/**
 * Evaluate code in Obsidian and wait for both synchronous and Promise results.
 *
 * Obsidian's CLI prints a synchronous result but does not await a returned
 * Promise. Keep the Promise state in the renderer and poll it through small,
 * synchronous evals so callers get real completion and error semantics.
 */
export async function obsidianEval(
	code: string,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
	const key = randomUUID();
	const keyLiteral = JSON.stringify(key);
	const store = "window.__TEXTFRESSER_CLI_EVAL_STATE__";
	const kickoff = `(()=>{const store=${store}??=Object.create(null);const key=${keyLiteral};store[key]={status:'pending'};Promise.resolve().then(()=>(${code})).then(value=>{let serialized='';try{serialized=typeof value==='string'?value:value===undefined?'':JSON.stringify(value)??String(value)}catch{serialized=String(value)}store[key]={status:'fulfilled',value:serialized}},error=>{const reason=error instanceof Error?(error.stack??error.message):String(error);store[key]={status:'rejected',reason}});return key})()`;
	const deadline = Date.now() + timeoutMs;
	const remaining = () => Math.max(250, deadline - Date.now());

	const startedKey = await runEvalProcess(kickoff, remaining());
	if (startedKey !== "" && startedKey !== key) {
		throw new Error(
			`eval did not return its completion key: ${startedKey}\ncode: ${code}`,
		);
	}

	while (Date.now() < deadline) {
		const stateJson = await runEvalProcess(
			`(()=>JSON.stringify(${store}?.[${keyLiteral}]??{status:'missing'}))()`,
			remaining(),
		);
		if (stateJson === "") {
			await Bun.sleep(50);
			continue;
		}
		const state = JSON.parse(stateJson) as EvalState | { status: "missing" };
		if (state.status === "fulfilled") {
			void runEvalProcess(`delete ${store}[${keyLiteral}]`, 1_000).catch(
				() => undefined,
			);
			return state.value;
		}
		if (state.status === "rejected") {
			void runEvalProcess(`delete ${store}[${keyLiteral}]`, 1_000).catch(
				() => undefined,
			);
			throw new Error(`eval failed: ${state.reason}\ncode: ${code}`);
		}
		if (state.status === "missing") {
			await runEvalProcess(kickoff, remaining());
		}
		await Bun.sleep(50);
	}

	void runEvalProcess(`delete ${store}?.[${keyLiteral}]`, 1_000).catch(
		() => undefined,
	);
	throw new Error(`eval timed out after ${timeoutMs}ms\ncode: ${code}`);
}
