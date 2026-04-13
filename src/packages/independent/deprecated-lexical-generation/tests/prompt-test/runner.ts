import {
	type RunResult,
	writeRunResult,
} from "./log-manager";
import { getGeminiApiKey } from "./env";
import {
	executeLexicalPromptFixtures,
	loadLexicalPromptFixtures,
	parsePromptSelectionArgs,
	resolveLexicalPromptTarget,
} from "./harness";

// --- CLI args ---

const selection = parsePromptSelectionArgs(process.argv.slice(2));
const prompt = resolveLexicalPromptTarget(selection);
const testExamples = await loadLexicalPromptFixtures(prompt);
if (!testExamples.length) {
	throw new Error(`No test fixtures found for ${prompt.name}`);
}

// --- API key ---

const apiKey = getGeminiApiKey();

// --- Run ---

const exampleResults = await executeLexicalPromptFixtures({
	apiKey,
	fixtures: testExamples,
	prompt,
});

// --- Write logs ---

const runResult: RunResult = {
	examples: exampleResults,
	knownLanguage: prompt.knownLanguage,
	model: "gemini-2.5-flash-lite",
	promptKind: prompt.promptKind,
	targetLanguage: prompt.targetLanguage,
	timestamp: new Date().toISOString(),
};

const _logDir = writeRunResult(runResult);

// --- Summary ---

const passed = exampleResults.filter((e) => e.matchesExpected).length;
const _schemaOk = exampleResults.filter((e) => e.schemaValid).length;
const total = exampleResults.length;

process.exit(passed === total ? 0 : 1);
