import { resolve } from "node:path";
import { runProviderAcceptance } from "./acceptance";
import {
	LEGACY_ASSERTION_OWNERSHIP,
	PROVIDER_SUITES,
	type ProviderSuite,
	selectProviderCases,
} from "./corpus";
import {
	createGeminiStructuredFetch,
	DEFAULT_GEMINI_MODEL,
} from "./gemini-provider";
import {
	defaultProviderArtifactDir,
	type ProviderAcceptanceReport,
	writeProviderAcceptanceReport,
} from "./report";

interface CliOptions {
	readonly artifactDir: string;
	readonly caseId?: string;
	readonly model: string;
	readonly suite: ProviderSuite | "all";
}

function readFlag(args: readonly string[], name: string): string | undefined {
	const prefix = `--${name}=`;
	return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function requireOptIn(
	env: Readonly<Record<string, string | undefined>>,
): string {
	if (env.TEXTFRESSER_PROVIDER_ACCEPTANCE !== "1") {
		throw new Error(
			"Provider acceptance is disabled. Set TEXTFRESSER_PROVIDER_ACCEPTANCE=1 to authorize live Gemini requests.",
		);
	}
	const apiKey = env.GEMINI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(
			"Missing GEMINI_API_KEY for the explicitly enabled provider acceptance run.",
		);
	}
	return apiKey;
}

export function parseCliOptions(
	args: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
): CliOptions {
	const suite = readFlag(args, "suite");
	if (
		!suite ||
		(suite !== "all" && !PROVIDER_SUITES.includes(suite as ProviderSuite))
	) {
		throw new Error(
			"Choose an explicit request budget with --suite=smoke, --suite=edge, or --suite=all.",
		);
	}
	const selectedSuite = suite as ProviderSuite | "all";
	const caseId = readFlag(args, "case")?.trim() || undefined;
	const configuredArtifactDir =
		env.TEXTFRESSER_PROVIDER_ARTIFACT_DIR?.trim();

	return {
		artifactDir: configuredArtifactDir
			? resolve(configuredArtifactDir)
			: defaultProviderArtifactDir(),
		...(caseId ? { caseId } : {}),
		model:
			env.TEXTFRESSER_PROVIDER_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
		suite: selectedSuite,
	};
}

function artifactStem(options: CliOptions): string {
	if (!options.caseId) return options.suite;
	const safeCaseId = options.caseId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
	return `${options.suite}-${safeCaseId}`;
}

async function main(): Promise<void> {
	const apiKey = requireOptIn(process.env);
	const options = parseCliOptions(process.argv.slice(2), process.env);
	const cases = selectProviderCases({
		...(options.caseId ? { caseId: options.caseId } : {}),
		suite: options.suite,
	});
	const results = await runProviderAcceptance({
		cases,
		fetchStructured: createGeminiStructuredFetch({
			apiKey,
			model: options.model,
		}),
		...(options.caseId ? { requestedCaseId: options.caseId } : {}),
	});
	const summary = {
		failed: results.filter((result) => !result.passed).length,
		passed: results.filter((result) => result.passed).length,
		total: results.length,
	};
	const report: ProviderAcceptanceReport = {
		assertionOwnership: LEGACY_ASSERTION_OWNERSHIP,
		generatedAt: new Date().toISOString(),
		model: options.model,
		results,
		schemaVersion: 1,
		selection: {
			...(options.caseId ? { caseId: options.caseId } : {}),
			suite: options.suite,
		},
		summary,
	};
	const paths = await writeProviderAcceptanceReport({
		artifactDir: options.artifactDir,
		fileStem: artifactStem(options),
		report,
	});

	for (const result of results) {
		console.log(
			`${result.passed ? "PASS" : "FAIL"} ${result.id}${result.prerequisite ? " (prerequisite)" : ""} ${result.durationMs}ms`,
		);
	}
	console.log(
		`Provider acceptance: ${summary.passed}/${summary.total} passed`,
	);
	console.log(`JSON report: ${paths.jsonPath}`);
	console.log(`Markdown report: ${paths.markdownPath}`);
	if (summary.failed > 0) process.exitCode = 1;
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
