import * as path from "node:path";
import { PROMPT_FOR, SchemasFor } from "../../internal/prompt-smith";
import { ALL_PROMPT_KINDS } from "../../internal/prompt-smith/codegen/consts";
import type { AvaliablePromptDict } from "../../internal/prompt-smith/types";
import { callGemini } from "./api-client";
import {
	type ExampleResult,
	type RunResult,
	writeRunResult,
} from "./log-manager";

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
	process.exit(1);
}

const promptKind = ALL_PROMPT_KINDS.find(
	(k) => k.toLowerCase() === promptKindArg.toLowerCase(),
);
if (!promptKind) {
	process.exit(1);
}

const targetLanguage = capitalize(targetArg) as keyof typeof PROMPT_FOR;
const knownLanguage = capitalize(
	knownArg,
) as keyof AvaliablePromptDict[typeof targetLanguage];

// Validate language pair exists in PROMPT_FOR
const targetDict = PROMPT_FOR[targetLanguage];
if (!targetDict) {
	process.exit(1);
}
const knownDict = targetDict[knownLanguage];
if (!knownDict) {
	process.exit(1);
}

const promptModule = knownDict[promptKind];
if (!promptModule) {
	process.exit(1);
}

// --- Load test examples ---

const toTestPath = path.resolve(
	import.meta.dir,
	"../../internal/prompt-smith/prompt-parts",
	toKebabCase(targetLanguage),
	toKebabCase(knownLanguage),
	toKebabCase(promptKind),
	"examples/to-test.ts",
);

let testExamples: { input: unknown; output: unknown }[];
try {
	const mod = await import(toTestPath);
	testExamples = mod.testExamples;
} catch (_err) {
	process.exit(1);
}

if (!testExamples.length) {
	process.exit(1);
}

// --- API key ---

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	process.exit(1);
}

// --- Run ---

const schema = SchemasFor[promptKind].agentOutputSchema;
const { systemPrompt } = promptModule;

const exampleResults: ExampleResult[] = [];

for (const [_i, example] of testExamples.entries()) {
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

	const _status = matchesExpected
		? "✅"
		: schemaValid
			? "⚠️  schema ok, mismatch"
			: "❌ error";
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

const _logDir = writeRunResult(runResult);

// --- Summary ---

const passed = exampleResults.filter((e) => e.matchesExpected).length;
const _schemaOk = exampleResults.filter((e) => e.schemaValid).length;
const total = exampleResults.length;

process.exit(passed === total ? 0 : 1);
