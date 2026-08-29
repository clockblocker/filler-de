import { spawn } from "node:child_process";
import { HarnessError } from "./errors";

export interface ProcessResult {
	readonly exitCode: number;
	readonly stderr: string;
	readonly stdout: string;
}

export interface RunProcessOptions {
	readonly cwd?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly inherit?: boolean;
	readonly timeoutMs?: number;
}

export async function runProcess(
	command: string,
	args: readonly string[],
	options: RunProcessOptions = {},
): Promise<ProcessResult> {
	const timeoutMs = options.timeoutMs ?? 30_000;
	return await new Promise<ProcessResult>((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const child = spawn(command, [...args], {
			cwd: options.cwd,
			env: options.env,
			stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
		});
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
		}, timeoutMs);

		if (!options.inherit) {
			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				stdout += chunk;
			});
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
			});
		}

		child.once("error", (cause) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(
				new HarnessError("PROCESS_FAILED", `Could not start ${command}`, {
					args,
					cause,
					command,
				}),
			);
		});
		child.once("close", (exitCode) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (timedOut) {
				reject(
					new HarnessError(
						"CLI_TIMEOUT",
						`${command} timed out after ${timeoutMs}ms`,
						{ args, command, stderr: stderr.trim(), stdout: stdout.trim(), timeoutMs },
					),
				);
				return;
			}
			resolve({
				exitCode: exitCode ?? 1,
				stderr: stderr.trim(),
				stdout: stdout.trim(),
			});
		});
	});
}
