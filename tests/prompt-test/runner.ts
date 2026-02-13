import * as path from "node:path";
import { PROMPT_FOR, SchemasFor } from "../../src/prompt-smith";
import type { PromptKind } from "../../src/prompt-smith/codegen/consts";
import { ALL_PROMPT_KINDS } from "../../src/prompt-smith/codegen/consts";
import type { AvaliablePromptDict } from "../../src/prompt-smith/types";
import { callGemini } from "./api-client";
import { type ExampleResult, type RunResult, writeRunResult } from "./log-manager";

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

// --- CLI args ---

const [promptKindArg, targetArg = "german", knownArg = "english"] =
	process.argv.slice(2);

if (!promptKindArg) {
	console.error(
		`Usage: bun run prompt:test <PromptKind> [targetLang] [knownLang]\n` +
			`Available kinds: ${ALL_PROMPT_KINDS.join(", ")}`,
	);
	process.exit(1);
}

const promptKind = ALL_PROMPT_KINDS.find(
	(k) => k.toLowerCase() === promptKindArg.toLowerCase(),
);
if (!promptKind) {
	console.error(
		`Unknown prompt kind: "${promptKindArg}"\n` +
			`Available: ${ALL_PROMPT_KINDS.join(", ")}`,
	);
	process.exit(1);
}

const targetLanguage = capitalize(targetArg) as keyof typeof PROMPT_FOR;
const knownLanguage = capitalize(knownArg) as keyof AvaliablePromptDict[typeof targetLanguage];

// Validate language pair exists in PROMPT_FOR
const targetDict = PROMPT_FOR[targetLanguage];
if (!targetDict) {
	console.error(
		`Unknown target language: "${targetLanguage}"\n` +
			`Available: ${Object.keys(PROMPT_FOR).join(", ")}`,
	);
	process.exit(1);
}
const knownDict = targetDict[knownLanguage];
if (!knownDict) {
	console.error(
		`Unknown known language: "${knownLanguage}" for target "${targetLanguage}"\n` +
			`Available: ${Object.keys(targetDict).join(", ")}`,
	);
	process.exit(1);
}

const promptModule = knownDict[promptKind];
if (!promptModule) {
	console.error(`No prompt found for ${targetLanguage}/${knownLanguage}/${promptKind}`);
	process.exit(1);
}

// --- Load test examples ---

const toTestPath = path.resolve(
	import.meta.dir,
	"../../src/prompt-smith/prompt-parts",
	toKebabCase(targetLanguage),
	toKebabCase(knownLanguage),
	toKebabCase(promptKind),
	"examples/to-test.ts",
);

let testExamples: { input: unknown; output: unknown }[];
try {
	const mod = await import(toTestPath);
	testExamples = mod.testExamples;
} catch (err) {
	console.error(`Failed to load test examples from ${toTestPath}:`, err);
	process.exit(1);
}

if (!testExamples.length) {
	console.error(
		`No test examples found in ${toTestPath}\n` +
			"Add examples to the testExamples array first.",
	);
	process.exit(1);
}

// --- API key ---

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	console.error("Missing GEMINI_API_KEY environment variable");
	process.exit(1);
}

// --- Run ---

const schema = SchemasFor[promptKind].agentOutputSchema;
const { systemPrompt } = promptModule;

console.log(
	`\nRunning ${testExamples.length} test(s) for ${promptKind} (${targetLanguage} → ${knownLanguage})\n`,
);

const exampleResults: ExampleResult[] = [];

for (let i = 0; i < testExamples.length; i++) {
	const example = testExamples[i];
	const userInput =
		typeof example.input === "string"
			? example.input
			: JSON.stringify(example.input);

	console.log(`  [${i + 1}/${testExamples.length}] ${userInput.slice(0, 60)}...`);

	const result = await callGemini({
		apiKey,
		schema,
		systemPrompt,
		userInput,
	});

	const schemaValid = result.parsed !== null && !result.error;
	const matchesExpected = deepEqual(result.parsed, example.output);

	exampleResults.push({
		actualOutput: result.parsed,
		durationMs: result.durationMs,
		expectedOutput: example.output,
		input: example.input,
		matchesExpected,
		schemaValid,
		...(result.error ? { error: result.error } : {}),
	});

	const status = matchesExpected ? "✅" : schemaValid ? "⚠️  schema ok, mismatch" : "❌ error";
	console.log(`         ${status} (${result.durationMs}ms)`);
}

// --- Write logs ---

const runResult: RunResult = {
	examples: exampleResults,
	knownLanguage,
	model: "gemini-2.5-flash-lite",
	promptKind,
	targetLanguage,
	timestamp: new Date().toISOString(),
};

const logDir = writeRunResult(runResult);

// --- Summary ---

const passed = exampleResults.filter((e) => e.matchesExpected).length;
const schemaOk = exampleResults.filter((e) => e.schemaValid).length;
const total = exampleResults.length;

console.log(`\n--- Summary ---`);
console.log(`Schema valid: ${schemaOk}/${total}`);
console.log(`Matches expected: ${passed}/${total}`);
console.log(`Logs: ${logDir}`);

process.exit(passed === total ? 0 : 1);
