import {
	createLexicalGenerationClient,
	createLexicalMeta,
	type LexicalGenerationClient,
	type LexicalInfo,
	type LexicalMeta,
	type ResolvedSelection,
	type StructuredFetchFn,
} from "@textfresser/lexical-generation-next";
import type {
	ExpectedSenseOutcome,
	ProviderAcceptanceCase,
} from "./corpus";

export interface AcceptanceCheck {
	readonly actual: unknown;
	readonly expected: unknown;
	readonly name: string;
	readonly passed: boolean;
}

export interface ProviderCaseResult {
	readonly checks: readonly AcceptanceCheck[];
	readonly durationMs: number;
	readonly error?: string;
	readonly generatedLexicalInfo: LexicalInfo | null;
	readonly id: string;
	readonly passed: boolean;
	readonly prerequisite: boolean;
	readonly selection: ResolvedSelection | null;
	readonly senseOutcome: ExpectedSenseOutcome | null;
	readonly testCase: ProviderAcceptanceCase;
}

interface ObservedClassification {
	readonly canonicalLemma: string | null;
	readonly discriminator: string | null;
	readonly lemmaKind: string | null;
}

interface StoredSense {
	readonly meta: LexicalMeta;
}

function normalizeGerman(value: string | null): string | null {
	return value?.normalize("NFC").toLocaleLowerCase("de") ?? null;
}

function observeClassification(
	selection: ResolvedSelection,
): ObservedClassification {
	if (selection.orthographicStatus === "Unknown") {
		return {
			canonicalLemma: null,
			discriminator: null,
			lemmaKind: null,
		};
	}

	return {
		canonicalLemma: selection.surface.target.canonicalLemma,
		discriminator: selection.surface.discriminators.lemmaSubKind,
		lemmaKind: selection.surface.discriminators.lemmaKind,
	};
}

function check(name: string, expected: unknown, actual: unknown): AcceptanceCheck {
	return { actual, expected, name, passed: Object.is(actual, expected) };
}

function errorResult(options: {
	checks: readonly AcceptanceCheck[];
	durationMs: number;
	error: string;
	prerequisite: boolean;
	selection?: ResolvedSelection;
	testCase: ProviderAcceptanceCase;
}): ProviderCaseResult {
	const checks = [
		...options.checks,
		check("provider operation completed", true, false),
	];
	return {
		checks,
		durationMs: options.durationMs,
		error: options.error,
		generatedLexicalInfo: null,
		id: options.testCase.id,
		passed: false,
		prerequisite: options.prerequisite,
		selection: options.selection ?? null,
		senseOutcome: null,
		testCase: options.testCase,
	};
}

function makeLexicalGenerationClient(
	fetchStructured: StructuredFetchFn,
): LexicalGenerationClient {
	const result = createLexicalGenerationClient({
		fetchStructured,
		knownLanguage: "English",
		settings: { generateInflections: true },
		targetLanguage: "German",
	});
	if (result.isErr()) {
		throw new Error(
			`Could not create lexical-generation client: ${result.error.kind}: ${result.error.message}`,
		);
	}
	return result.value;
}

export async function runProviderAcceptance(options: {
	readonly cases: readonly ProviderAcceptanceCase[];
	readonly fetchStructured: StructuredFetchFn;
	readonly requestedCaseId?: string;
}): Promise<readonly ProviderCaseResult[]> {
	const lexicalGeneration = makeLexicalGenerationClient(
		options.fetchStructured,
	);
	const sensesByLemma = new Map<string, StoredSense[]>();
	const results: ProviderCaseResult[] = [];

	for (const testCase of options.cases) {
		const startedAt = performance.now();
		const prerequisite =
			options.requestedCaseId !== undefined &&
			testCase.id !== options.requestedCaseId;
		const resolution = await lexicalGeneration.resolveSelection(
			testCase.selection,
			testCase.attestation,
		);
		if (resolution.isErr()) {
			results.push(
				errorResult({
					checks: [],
					durationMs: Math.round(performance.now() - startedAt),
					error: `${resolution.error.kind}: ${resolution.error.message}`,
					prerequisite,
					testCase,
				}),
			);
			continue;
		}

		const selection = resolution.value;
		const observed = observeClassification(selection);
		const checks: AcceptanceCheck[] = [
			check(
				"canonical lemma",
				normalizeGerman(testCase.expected.canonicalLemma),
				normalizeGerman(observed.canonicalLemma),
			),
			check(
				"lemma kind",
				testCase.expected.lemmaKind,
				observed.lemmaKind,
			),
			check(
				"discriminator",
				testCase.expected.discriminator,
				observed.discriminator,
			),
		];

		if (!observed.canonicalLemma) {
			results.push(
				errorResult({
					checks,
					durationMs: Math.round(performance.now() - startedAt),
					error: "Selection resolved as Unknown",
					prerequisite,
					selection,
					testCase,
				}),
			);
			continue;
		}

		const lemmaKey = normalizeGerman(observed.canonicalLemma) ?? "";
		const storedSenses = sensesByLemma.get(lemmaKey) ?? [];
		const disambiguation = await lexicalGeneration.disambiguateSense(
			selection,
			testCase.attestation,
			storedSenses.map((sense) => sense.meta),
		);
		if (disambiguation.isErr()) {
			results.push(
				errorResult({
					checks,
					durationMs: Math.round(performance.now() - startedAt),
					error: `${disambiguation.error.kind}: ${disambiguation.error.message}`,
					prerequisite,
					selection,
					testCase,
				}),
			);
			continue;
		}

		const senseOutcome = disambiguation.value.kind;
		checks.push(
			check(
				"sense outcome",
				testCase.expected.senseOutcome,
				senseOutcome,
			),
		);

		let generatedLexicalInfo: LexicalInfo | null = null;
		if (disambiguation.value.kind === "new") {
			const generated = await lexicalGeneration.generateLexicalInfo(
				selection,
				testCase.attestation,
				{
					precomputedSenseEmojis:
						disambiguation.value.precomputedSenseEmojis,
				},
			);
			if (generated.isErr()) {
				results.push(
					errorResult({
						checks,
						durationMs: Math.round(performance.now() - startedAt),
						error: `${generated.error.kind}: ${generated.error.message}`,
						prerequisite,
						selection,
						testCase,
					}),
				);
				continue;
			}

			generatedLexicalInfo = generated.value;
			checks.push(
				check(
					"lexical core status",
					"ready",
					generatedLexicalInfo.core.status,
				),
			);
			if (generatedLexicalInfo.core.status === "ready") {
				const lexicalMeta = createLexicalMeta({
					selection,
					senseEmojis:
						generatedLexicalInfo.core.value.senseEmojis,
				});
				checks.push(
					check("lexical sense metadata", true, lexicalMeta.isOk()),
				);
				if (lexicalMeta.isOk()) {
					storedSenses.push({ meta: lexicalMeta.value });
					sensesByLemma.set(lemmaKey, storedSenses);
				}
			}
		}

		const passed = checks.every((assertion) => assertion.passed);
		results.push({
			checks,
			durationMs: Math.round(performance.now() - startedAt),
			generatedLexicalInfo,
			id: testCase.id,
			passed,
			prerequisite,
			selection,
			senseOutcome,
			testCase,
		});
	}

	return results;
}
