import * as path from "node:path";
import {
	getLexicalPromptOutputSchema,
	getLexicalPromptSystemPrompt,
	type PromptKind,
} from "../../src/prompt-api";
import {
	ALL_KNOWN_LANGUAGES,
	ALL_TARGET_LANGUAGES,
	type KnownLanguage,
	type TargetLanguage,
} from "../../src/internal/shared/languages";
import { ALL_PROMPT_KINDS } from "../../src/internal/prompt-smith/codegen/consts";
import { callGemini, type ApiCallResult } from "./api-client";
import type { z } from "zod/v3";

export type PromptFixture = {
	input: unknown;
	output: unknown;
};

export type StructuredPrompt<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
	name: string;
	schema: TSchema;
	systemPrompt: string;
};

export type LexicalPromptTarget = StructuredPrompt & {
	knownLanguage: KnownLanguage;
	promptKind: PromptKind;
	targetLanguage: TargetLanguage;
};

export type StructuredPromptClient = <TSchema extends z.ZodTypeAny>(opts: {
	apiKey: string;
	schema: TSchema;
	systemPrompt: string;
	userInput: string;
}) => Promise<ApiCallResult<z.infer<TSchema>>>;

export type PromptCaseResult = {
	actualOutput: unknown;
	durationMs: number;
	error?: string;
	expectedOutput: unknown;
	input: unknown;
	matchesExpected: boolean;
	raw: string;
	schemaValid: boolean;
};

export type LivePromptSelection = {
	caseIndex: number;
	knownLanguage: KnownLanguage;
	promptKind: PromptKind;
	targetLanguage: TargetLanguage;
};

function matchSupportedValue<TValue extends string>(
	value: string,
	supported: readonly TValue[],
	label: string,
): TValue {
	const matched = supported.find(
		(candidate) => candidate.toLowerCase() === value.toLowerCase(),
	);
	if (!matched) {
		throw new Error(
			`Unsupported ${label}: "${value}". Supported values: ${supported.join(", ")}`,
		);
	}
	return matched;
}

function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a === b;

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
			return false;
		}

		return a.every((item, index) => deepEqual(item, b[index]));
	}

	if (typeof a !== typeof b || typeof a !== "object") {
		return false;
	}

	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const aKeys = Object.keys(aObj).sort();
	const bKeys = Object.keys(bObj).sort();

	if (aKeys.length !== bKeys.length) {
		return false;
	}

	return aKeys.every(
		(key) => bKeys.includes(key) && deepEqual(aObj[key], bObj[key]),
	);
}

export function formatPromptInput(input: unknown): string {
	return typeof input === "string" ? input : JSON.stringify(input);
}

export function parseLivePromptSelection(
	env: Record<string, string | undefined>,
): LivePromptSelection {
	const promptKind = matchSupportedValue(
		env.PROMPT_TEST_KIND ?? "Lemma",
		ALL_PROMPT_KINDS,
		"prompt kind",
	);
	const targetLanguage = matchSupportedValue(
		env.PROMPT_TEST_TARGET_LANGUAGE ?? "German",
		ALL_TARGET_LANGUAGES,
		"target language",
	);
	const knownLanguage = matchSupportedValue(
		env.PROMPT_TEST_KNOWN_LANGUAGE ?? "English",
		ALL_KNOWN_LANGUAGES,
		"known language",
	);
	const caseIndex = Number(env.PROMPT_TEST_CASE_INDEX ?? "1");

	if (!Number.isInteger(caseIndex) || caseIndex < 1) {
		throw new Error(
			`PROMPT_TEST_CASE_INDEX must be a positive integer, received "${env.PROMPT_TEST_CASE_INDEX ?? "1"}"`,
		);
	}

	return {
		caseIndex,
		knownLanguage,
		promptKind,
		targetLanguage,
	};
}

export function parsePromptSelectionArgs(
	args: string[],
): Omit<LivePromptSelection, "caseIndex"> {
	const [promptKindArg, targetLanguageArg = "German", knownLanguageArg = "English"] =
		args;

	if (!promptKindArg) {
		throw new Error(
			"Usage: <promptKind> [targetLanguage=German] [knownLanguage=English]",
		);
	}

	return {
		knownLanguage: matchSupportedValue(
			knownLanguageArg,
			ALL_KNOWN_LANGUAGES,
			"known language",
		),
		promptKind: matchSupportedValue(
			promptKindArg,
			ALL_PROMPT_KINDS,
			"prompt kind",
		),
		targetLanguage: matchSupportedValue(
			targetLanguageArg,
			ALL_TARGET_LANGUAGES,
			"target language",
		),
	};
}

export function resolveLexicalPromptTarget(
	params: Omit<LivePromptSelection, "caseIndex">,
): LexicalPromptTarget {
	return {
		knownLanguage: params.knownLanguage,
		name: `${params.promptKind}:${params.targetLanguage}-${params.knownLanguage}`,
		promptKind: params.promptKind,
		schema: getLexicalPromptOutputSchema(params.promptKind),
		systemPrompt: getLexicalPromptSystemPrompt({
			kind: params.promptKind,
			known: params.knownLanguage,
			target: params.targetLanguage,
		}),
		targetLanguage: params.targetLanguage,
	};
}

export async function loadLexicalPromptFixtures(
	params: Omit<LexicalPromptTarget, "name" | "schema" | "systemPrompt">,
): Promise<PromptFixture[]> {
	const fixturesPath = path.resolve(
		import.meta.dir,
		"../../src/internal/prompt-smith/prompt-parts",
		toKebabCase(params.targetLanguage),
		toKebabCase(params.knownLanguage),
		toKebabCase(params.promptKind),
		"examples/to-test.ts",
	);

	const mod = await import(fixturesPath);
	return (mod.testExamples as PromptFixture[] | undefined) ?? [];
}

export async function executeStructuredPromptCase<
	TSchema extends z.ZodTypeAny,
>(opts: {
	apiKey: string;
	client?: StructuredPromptClient;
	example: PromptFixture;
	prompt: StructuredPrompt<TSchema>;
}): Promise<PromptCaseResult> {
	const client = opts.client ?? callGemini;
	const result = await client({
		apiKey: opts.apiKey,
		schema: opts.prompt.schema,
		systemPrompt: opts.prompt.systemPrompt,
		userInput: formatPromptInput(opts.example.input),
	});
	const schemaValid = result.parsed !== null && !result.error;

	return {
		actualOutput: result.parsed,
		durationMs: result.durationMs,
		...(result.error ? { error: result.error } : {}),
		expectedOutput: opts.example.output,
		input: opts.example.input,
		matchesExpected: deepEqual(result.parsed, opts.example.output),
		raw: result.raw,
		schemaValid,
	};
}

export async function executeLexicalPromptFixtures(opts: {
	apiKey: string;
	client?: StructuredPromptClient;
	fixtures: PromptFixture[];
	prompt: LexicalPromptTarget;
}): Promise<PromptCaseResult[]> {
	const results: PromptCaseResult[] = [];

	for (const example of opts.fixtures) {
		results.push(
			await executeStructuredPromptCase({
				apiKey: opts.apiKey,
				client: opts.client,
				example,
				prompt: opts.prompt,
			}),
		);
	}

	return results;
}
