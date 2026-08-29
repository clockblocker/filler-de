import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProviderCaseResult } from "./acceptance";
import { LEGACY_ASSERTION_OWNERSHIP } from "./corpus";

export interface ProviderAcceptanceReport {
	readonly assertionOwnership: typeof LEGACY_ASSERTION_OWNERSHIP;
	readonly generatedAt: string;
	readonly model: string;
	readonly results: readonly ProviderCaseResult[];
	readonly schemaVersion: 1;
	readonly selection: {
		readonly caseId?: string;
		readonly suite: string;
	};
	readonly summary: {
		readonly failed: number;
		readonly passed: number;
		readonly total: number;
	};
}

function markdownCell(value: unknown): string {
	return String(value ?? "-")
		.replaceAll("|", "\\|")
		.replaceAll("\n", " ");
}

function renderProviderAcceptanceMarkdown(
	report: ProviderAcceptanceReport,
): string {
	const lines = [
		"# Textfresser provider acceptance",
		"",
		`- Generated: ${report.generatedAt}`,
		`- Model: ${report.model}`,
		`- Selection: ${report.selection.suite}${report.selection.caseId ? ` / ${report.selection.caseId}` : ""}`,
		`- Result: ${report.summary.passed} passed, ${report.summary.failed} failed`,
		"",
		"## Provider assertions",
		"",
		...report.assertionOwnership.provider.map((item) => `- ${item}`),
		"",
		"## Results",
		"",
		"| ID | Role | Surface | Expected lemma | Actual lemma | Sense | Result |",
		"| --- | --- | --- | --- | --- | --- | --- |",
	];

	for (const result of report.results) {
		const actualLemma =
			result.selection?.orthographicStatus === "Unknown"
				? null
				: result.selection?.surface.target.canonicalLemma;
		lines.push(
			`| ${markdownCell(result.id)} | ${result.prerequisite ? "prerequisite" : "requested"} | ${markdownCell(result.testCase.selection)} | ${markdownCell(result.testCase.expected.canonicalLemma)} | ${markdownCell(actualLemma)} | ${markdownCell(result.senseOutcome)} | ${result.passed ? "PASS" : "FAIL"} |`,
		);
		if (!result.passed) {
			for (const assertion of result.checks.filter((item) => !item.passed)) {
				lines.push(
					`| ↳ ${markdownCell(assertion.name)} |  |  | ${markdownCell(assertion.expected)} | ${markdownCell(assertion.actual)} |  | FAIL |`,
				);
			}
			if (result.error) {
				lines.push(
					`| ↳ error |  |  |  | ${markdownCell(result.error)} |  | FAIL |`,
				);
			}
		}
	}

	lines.push(
		"",
		"## Assertions intentionally outside this suite",
		"",
		...report.assertionOwnership.orchestration.map((item) => `- ${item}`),
		"",
	);
	return lines.join("\n");
}

async function writeAtomically(path: string, content: string): Promise<void> {
	const temporaryPath = `${path}.tmp`;
	await writeFile(temporaryPath, content, "utf8");
	await rename(temporaryPath, path);
}

export async function writeProviderAcceptanceReport(options: {
	readonly artifactDir: string;
	readonly fileStem: string;
	readonly report: ProviderAcceptanceReport;
}): Promise<{ readonly jsonPath: string; readonly markdownPath: string }> {
	await mkdir(options.artifactDir, { recursive: true });
	const jsonPath = join(options.artifactDir, `${options.fileStem}.json`);
	const markdownPath = join(options.artifactDir, `${options.fileStem}.md`);
	await Promise.all([
		writeAtomically(jsonPath, `${JSON.stringify(options.report, null, 2)}\n`),
		writeAtomically(
			markdownPath,
			renderProviderAcceptanceMarkdown(options.report),
		),
	]);
	return { jsonPath, markdownPath };
}

export function defaultProviderArtifactDir(): string {
	return resolve(import.meta.dir, "..", "artifacts", "textfresser");
}
