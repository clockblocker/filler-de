import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ObsidianCli } from "./cli";
import { describeError } from "./errors";

export async function prepareDiagnostics(cli: ObsidianCli): Promise<void> {
	await cli.call(["dev:debug", "on"], { allowErrorText: true }).catch(() => undefined);
	await cli.call(["dev:errors", "clear"], { allowErrorText: true }).catch(() => undefined);
}

export async function captureFailureDiagnostics(
	cli: ObsidianCli,
	artifactDir: string,
): Promise<void> {
	const failureDir = resolve(artifactDir, "failure");
	await mkdir(failureDir, { recursive: true });
	const attempts: Array<readonly [string, readonly string[]]> = [
		["dev-errors.txt", ["dev:errors"]],
		["dev-console.txt", ["dev:console", "level=warn", "limit=200"]],
	];
	const diagnosticErrors: string[] = [];
	for (const [file, args] of attempts) {
		try {
			const result = await cli.call(args, {
				allowErrorText: true,
				timeoutMs: 10_000,
			});
			await writeFile(
				resolve(failureDir, file),
				`${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}\n`,
				"utf8",
			);
		} catch (error) {
			diagnosticErrors.push(`${args[0]}: ${describeError(error)}`);
		}
	}
	try {
		await cli.call(
			["dev:screenshot", `path=${resolve(failureDir, "screenshot.png")}`],
			{ allowErrorText: true, timeoutMs: 15_000 },
		);
	} catch (error) {
		diagnosticErrors.push(`dev:screenshot: ${describeError(error)}`);
	}
	if (diagnosticErrors.length > 0) {
		await writeFile(
			resolve(failureDir, "diagnostics-errors.txt"),
			`${diagnosticErrors.join("\n\n")}\n`,
			"utf8",
		);
	}
}
