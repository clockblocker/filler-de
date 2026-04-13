import * as fs from "node:fs";
import * as path from "node:path";
import type { PromptKind } from "../../src/internal/prompt-smith/codegen/consts";
import { getGeminiApiKey } from "./env";
import {
	executeStructuredPromptCase,
	loadLexicalPromptFixtures,
	parsePromptSelectionArgs,
	resolveLexicalPromptTarget,
} from "./harness";

function serializeOutput(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

const [runsArg, targetArg = "german", knownArg = "english"] =
	process.argv.slice(2);
const repeats = Number(runsArg ?? "5");

if (!Number.isFinite(repeats) || repeats < 1) {
	throw new Error(
		"Usage: bun run tests/prompt-test/stability-runner.ts [repeats>=1] [targetLang] [knownLang]",
	);
}

const apiKey = getGeminiApiKey();

const promptKinds: PromptKind[] = ["Lemma", "Disambiguate"];
const targetLanguage = targetArg.toLowerCase();
const knownLanguage = knownArg.toLowerCase();

const startedAt = new Date().toISOString();
const report: Record<string, unknown> = {
	knownLanguage,
	model: "gemini-2.5-flash-lite",
	promptKinds,
	repeats,
	results: [],
	startedAt,
	targetLanguage,
};

for (const promptKind of promptKinds) {
	const prompt = resolveLexicalPromptTarget(
		parsePromptSelectionArgs([promptKind, targetArg, knownArg]),
	);
	const examples = await loadLexicalPromptFixtures(prompt);

	if (examples.length === 0) {
		continue;
	}

	const kindResult: Record<string, unknown> = {
		examples: [],
		promptKind,
	};

	for (const [exampleIndex, example] of examples.entries()) {
		let passCount = 0;
		const outputs = new Map<string, number>();

		for (let run = 0; run < repeats; run++) {
			const result = await executeStructuredPromptCase({
				apiKey,
				example,
				prompt,
			});
			if (result.matchesExpected) {
				passCount += 1;
			}

			const key = serializeOutput(result.actualOutput);
			outputs.set(key, (outputs.get(key) ?? 0) + 1);
		}

		(kindResult.examples as Array<Record<string, unknown>>).push({
			distribution: [...outputs.entries()].map(([output, count]) => ({
				count,
				output,
			})),
			exampleIndex: exampleIndex + 1,
			expectedOutput: example.output,
			input: example.input,
			passes: passCount,
			passRate: passCount / repeats,
		});
	}

	(report.results as Array<Record<string, unknown>>).push(kindResult);
}

const ts = startedAt.replace(/[:.]/g, "-");
const outDir = path.resolve(import.meta.dir, "logs", `${ts}_stability`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
	path.join(outDir, "result.json"),
	JSON.stringify(report, null, 2),
);

const markdownLines: string[] = [
	"# Prompt Stability Report",
	`- Started: ${startedAt}`,
	`- Repeats per example: ${repeats}`,
	`- Target/known: ${targetLanguage}/${knownLanguage}`,
	"",
];

for (const kindResult of report.results as Array<Record<string, unknown>>) {
	markdownLines.push(`## ${kindResult.promptKind as string}`, "");
	for (const example of kindResult.examples as Array<
		Record<string, unknown>
	>) {
		markdownLines.push(
			`### Example ${example.exampleIndex as number}`,
			`- Passes: ${example.passes as number}/${repeats} (rate=${example.passRate})`,
			`- Input: \`${JSON.stringify(example.input)}\``,
			`- Expected: \`${JSON.stringify(example.expectedOutput)}\``,
			"- Output distribution:",
		);
		for (const dist of example.distribution as Array<
			Record<string, unknown>
		>) {
			markdownLines.push(
				`  - ${dist.count as number}x \`${dist.output as string}\``,
			);
		}
		markdownLines.push("");
	}
}

fs.writeFileSync(path.join(outDir, "result.md"), markdownLines.join("\n"));
