import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { HarnessError } from "./errors";
import { type ProcessResult, runProcess } from "./process";

const CLI_NOISE = ["Loading updated app package", "Checking for updates"];
const BUNDLED_MACOS_CLI =
	"/Applications/Obsidian.app/Contents/MacOS/obsidian-cli";

interface ObsidianCliOptions {
	readonly cliPath: string;
	readonly vaultName: string;
}

export function stripCliNoise(value: string): string {
	return value
		.split(/\r?\n/u)
		.filter((line) => !CLI_NOISE.some((noise) => line.includes(noise)))
		.join("\n")
		.trim();
}

export function parseCliJson<T>(output: string, command: string): T {
	const clean = stripCliNoise(output).replace(/^=>\s*/u, "");
	if (/^Error(?:\s|:)/u.test(clean)) {
		throw new HarnessError("CLI_REPORTED_ERROR", `${command} reported an error`, {
			command,
			stdout: clean,
		});
	}
	try {
		return JSON.parse(clean) as T;
	} catch (cause) {
		throw new HarnessError(
			"CLI_PROTOCOL",
			`${command} did not return a JSON response`,
			{ cause, command, stdout: clean },
		);
	}
}

export function isOfficialCliTarget(path: string): boolean {
	return basename(path).toLowerCase() === "obsidian-cli";
}

export async function resolveOfficialCli(
	explicitPath = process.env.OBSIDIAN_CLI_PATH,
): Promise<string> {
	const candidates = [
		explicitPath,
		Bun.which("obsidian"),
		Bun.which("obsidian-cli"),
		BUNDLED_MACOS_CLI,
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		const absolute = resolve(candidate);
		try {
			await access(absolute, constants.X_OK);
			const target = await realpath(absolute);
			if (!isOfficialCliTarget(target)) {
				if (candidate === explicitPath) {
					throw new HarnessError(
						"CLI_INVALID",
						`OBSIDIAN_CLI_PATH resolves to ${target}; expected the official obsidian-cli binary, not the GUI executable`,
					);
				}
				continue;
			}
			return target;
		} catch (cause) {
			if (cause instanceof HarnessError) throw cause;
			if (candidate === explicitPath) {
				throw new HarnessError(
					"CLI_INVALID",
					`OBSIDIAN_CLI_PATH is not an executable official CLI: ${absolute}`,
					{ cause },
				);
			}
		}
	}

	throw new HarnessError(
		"CLI_INVALID",
		"Could not find the official obsidian-cli. Enable Obsidian CLI or set OBSIDIAN_CLI_PATH.",
	);
}

export class ObsidianCli {
	readonly #cliPath: string;
	readonly #vaultName: string;
	#tail: Promise<void> = Promise.resolve();

	constructor(options: ObsidianCliOptions) {
		this.#cliPath = options.cliPath;
		this.#vaultName = options.vaultName;
	}

	get path(): string {
		return this.#cliPath;
	}

	async call(
		args: readonly string[],
		options: { readonly allowErrorText?: boolean; readonly timeoutMs?: number } = {},
	): Promise<ProcessResult> {
		const operation = this.#tail.then(async () => {
			const fullArgs = [`vault=${this.#vaultName}`, ...args];
			const result = await runProcess(this.#cliPath, fullArgs, {
				timeoutMs: options.timeoutMs,
			});
			const normalized = {
				...result,
				stderr: stripCliNoise(result.stderr),
				stdout: stripCliNoise(result.stdout),
			};
			const command = [this.#cliPath, ...fullArgs].join(" ");
			if (normalized.exitCode !== 0) {
				throw new HarnessError(
					"CLI_NON_ZERO",
					`Obsidian CLI exited with ${normalized.exitCode}`,
					{ command, ...normalized },
				);
			}
			if (
				!options.allowErrorText &&
				(/^Error(?:\s|:)/u.test(normalized.stdout) ||
					/^Error(?:\s|:)/u.test(normalized.stderr))
			) {
				throw new HarnessError(
					"CLI_REPORTED_ERROR",
					"Obsidian CLI reported an error despite exiting successfully",
					{ command, ...normalized },
				);
			}
			return normalized;
		});

		this.#tail = operation.then(
			() => undefined,
			() => undefined,
		);
		return await operation;
	}

	async json<T>(
		args: readonly string[],
		options: { readonly timeoutMs?: number } = {},
	): Promise<T> {
		const result = await this.call(args, options);
		return parseCliJson<T>(result.stdout, args.join(" "));
	}
}
