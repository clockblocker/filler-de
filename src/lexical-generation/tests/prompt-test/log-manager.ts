import * as fs from "node:fs";
import * as path from "node:path";

const LOGS_DIR = path.resolve(import.meta.dir, "logs");
const MAX_RUNS = 10;

export type ExampleResult = {
	input: unknown;
	expectedOutput: unknown;
	actualOutput: unknown;
	schemaValid: boolean;
	matchesExpected: boolean;
	durationMs: number;
	error?: string;
};

export type RunResult = {
	promptKind: string;
	targetLanguage: string;
	knownLanguage: string;
	model: string;
	timestamp: string;
	examples: ExampleResult[];
};

function formatRunDir(result: RunResult): string {
	const ts = result.timestamp.replace(/[:.]/g, "-");
	return `${ts}_${result.promptKind}_${result.targetLanguage}-${result.knownLanguage}`;
}

function generateMarkdown(result: RunResult): string {
	const lines: string[] = [
		`# Prompt Test: ${result.promptKind} (${result.targetLanguage} → ${result.knownLanguage})`,
		`**Model**: ${result.model} | **Date**: ${result.timestamp}`,
		"",
	];

	const passed = result.examples.filter((e) => e.matchesExpected).length;
	const schemaOk = result.examples.filter((e) => e.schemaValid).length;
	lines.push(
		`**Summary**: ${passed}/${result.examples.length} match expected | ${schemaOk}/${result.examples.length} schema valid`,
		"",
	);

	for (let i = 0; i < result.examples.length; i++) {
		const ex = result.examples[i];
		lines.push(
			`## Example ${i + 1}`,
			`**Input**: \`${JSON.stringify(ex.input)}\``,
			`**Expected**: \`${JSON.stringify(ex.expectedOutput)}\``,
			`**Actual**: \`${JSON.stringify(ex.actualOutput)}\``,
			`**Schema valid**: ${ex.schemaValid ? "✅" : "❌"} | **Matches expected**: ${ex.matchesExpected ? "✅" : "❌"}`,
			`**Duration**: ${ex.durationMs}ms`,
		);
		if (ex.error) {
			lines.push(`**Error**: ${ex.error}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function rotateOldRuns(): void {
	if (!fs.existsSync(LOGS_DIR)) return;

	const entries = fs
		.readdirSync(LOGS_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	const toDelete = entries.slice(0, Math.max(0, entries.length - MAX_RUNS));
	for (const dir of toDelete) {
		fs.rmSync(path.join(LOGS_DIR, dir), { force: true, recursive: true });
	}
}

export function writeRunResult(result: RunResult): string {
	const runDirName = formatRunDir(result);
	const runDir = path.join(LOGS_DIR, runDirName);
	fs.mkdirSync(runDir, { recursive: true });

	fs.writeFileSync(
		path.join(runDir, "result.json"),
		JSON.stringify(result, null, 2),
	);
	fs.writeFileSync(path.join(runDir, "result.md"), generateMarkdown(result));

	rotateOldRuns();

	return runDir;
}
