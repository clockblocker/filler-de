import * as fs from "node:fs";
import * as path from "node:path";
import { PROMPT_FOR, SchemasFor } from "../../src/prompt-smith";
import type { PromptKind } from "../../src/prompt-smith/codegen/consts";
import { callGemini } from "./api-client";

type Example = { input: unknown; output: unknown };

function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a === b;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;

	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const aKeys = Object.keys(aObj).sort();
	const bKeys = Object.keys(bObj).sort();

	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every(
		(key) => bKeys.includes(key) && deepEqual(aObj[key], bObj[key]),
	);
}

function serializeOutput(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

async function loadTestExamples(
	targetLanguage: string,
	knownLanguage: string,
	promptKind: PromptKind,
): Promise<Example[]> {
	const toTestPath = path.resolve(
		import.meta.dir,
		"../../src/prompt-smith/prompt-parts",
		toKebabCase(targetLanguage),
		toKebabCase(knownLanguage),
		toKebabCase(promptKind),
		"examples/to-test.ts",
	);

	const mod = await import(toTestPath);
	return (mod.testExamples as Example[]) ?? [];
}

function getSystemPrompt(params: {
	knownLanguage: string;
	promptKind: PromptKind;
	targetLanguage: string;
}): string {
	const targetDict =
		PROMPT_FOR[capitalize(params.targetLanguage) as keyof typeof PROMPT_FOR];
	const knownDict =
		targetDict?.[
			capitalize(
				params.knownLanguage,
			) as keyof (typeof targetDict)[keyof typeof targetDict]
		];
	const prompt =
		knownDict?.[params.promptKind as keyof typeof knownDict];

	if (!prompt) {
		throw new Error(
			`Prompt not found for ${params.targetLanguage}/${params.knownLanguage}/${params.promptKind}`,
		);
	}

	return prompt.systemPrompt;
}

const [runsArg, targetArg = "german", knownArg = "english"] =
	process.argv.slice(2);
const repeats = Number(runsArg ?? "5");

if (!Number.isFinite(repeats) || repeats < 1) {
	throw new Error("Usage: bun run tests/prompt-test/stability-runner.ts [repeats>=1] [targetLang] [knownLang]");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	throw new Error("Missing GEMINI_API_KEY environment variable");
}

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
	const schema = SchemasFor[promptKind].agentOutputSchema;
	const systemPrompt = getSystemPrompt({
		knownLanguage,
		promptKind,
		targetLanguage,
	});
	const examples = await loadTestExamples(
		targetLanguage,
		knownLanguage,
		promptKind,
	);

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
			const userInput =
				typeof example.input === "string"
					? example.input
					: JSON.stringify(example.input);

			const result = await callGemini({
				apiKey,
				schema,
				systemPrompt,
				userInput,
			});
			const actual = result.parsed;
			const matchesExpected = deepEqual(actual, example.output);
			if (matchesExpected) {
				passCount += 1;
			}

			const key = serializeOutput(actual);
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
	for (const example of kindResult.examples as Array<Record<string, unknown>>) {
		markdownLines.push(
			`### Example ${example.exampleIndex as number}`,
			`- Passes: ${example.passes as number}/${repeats} (rate=${example.passRate})`,
			`- Input: \`${JSON.stringify(example.input)}\``,
			`- Expected: \`${JSON.stringify(example.expectedOutput)}\``,
			"- Output distribution:",
		);
		for (const dist of example.distribution as Array<Record<string, unknown>>) {
			markdownLines.push(
				`  - ${dist.count as number}x \`${dist.output as string}\``,
			);
		}
		markdownLines.push("");
	}
}

fs.writeFileSync(path.join(outDir, "result.md"), markdownLines.join("\n"));
console.log(`Stability report written to: ${outDir}`);
