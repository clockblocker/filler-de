import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDumgen, type OperationTrace } from "dumgen";
import * as Effect from "effect/Effect";
import {
	createDumgenProviders,
	createRequestUrlFetch,
	type DumgenProviderKeys,
	type RequestUrl,
} from "../../../src/managers/dumgen";
import { runDumgenSmoke, SMOKE_SENTENCE } from "./smoke";

type Env = Readonly<Record<string, string | undefined>>;

interface CliOptions {
	readonly artifactDir: string;
	readonly suite: "smoke";
}

/** Each request's deadline in the smoke; a click's, not intake's. */
const SMOKE_TIMEOUT_MS = 60_000;

function readFlag(args: readonly string[], name: string): string | undefined {
	const prefix = `--${name}=`;
	return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function requireOptIn(env: Env): DumgenProviderKeys {
	if (env.TEXTFRESSER_PROVIDER_ACCEPTANCE !== "1") {
		throw new Error(
			"Provider acceptance is disabled. Set TEXTFRESSER_PROVIDER_ACCEPTANCE=1 to authorize live TypeSafe and OpenAI requests.",
		);
	}
	const typesafeApiKey = env.TYPESAFE_API_KEY?.trim();
	const openaiApiKey = env.OPENAI_API_KEY?.trim();
	const missing = [
		...(typesafeApiKey ? [] : ["TYPESAFE_API_KEY"]),
		...(openaiApiKey ? [] : ["OPENAI_API_KEY"]),
	];
	if (!typesafeApiKey || !openaiApiKey) {
		throw new Error(
			`Missing ${missing.join(" and ")} for the explicitly enabled dumgen acceptance run.`,
		);
	}
	return { openaiApiKey, typesafeApiKey };
}

export function parseCliOptions(args: readonly string[], env: Env): CliOptions {
	if (readFlag(args, "suite") !== "smoke") {
		throw new Error(
			"Choose an explicit request budget with --suite=smoke: one Sentence segmented, one click resolved, one Sentence translated.",
		);
	}
	const configuredArtifactDir =
		env.TEXTFRESSER_PROVIDER_ARTIFACT_DIR?.trim();
	return {
		artifactDir: configuredArtifactDir
			? resolve(configuredArtifactDir, "dumgen")
			: resolve(import.meta.dir, "..", "artifacts", "dumgen"),
		suite: "smoke",
	};
}

/**
 * The runtime's `fetch` standing in for Obsidian's `requestUrl`, so the
 * smoke sends through the plugin's own requestUrl port. Like `requestUrl`,
 * it takes no signal.
 */
const fetchAsRequestUrl: RequestUrl = async (request) => {
	const response = await fetch(request.url, {
		...(request.body === undefined ? {} : { body: request.body }),
		...(request.headers === undefined ? {} : { headers: request.headers }),
		...(request.method === undefined ? {} : { method: request.method }),
	});
	return { status: response.status, text: await response.text() };
};

async function main(): Promise<void> {
	const keys = requireOptIn(process.env);
	const options = parseCliOptions(process.argv.slice(2), process.env);
	const traces: OperationTrace[] = [];
	const dumgen = createDumgen({
		...createDumgenProviders({
			...keys,
			fetch: createRequestUrlFetch(fetchAsRequestUrl),
			timeoutMs: SMOKE_TIMEOUT_MS,
		}),
		onOperation: (trace) => traces.push(trace),
	});
	const checks = await Effect.runPromise(runDumgenSmoke(dumgen));
	const operations = traces.map((trace) => ({
		calls: trace.calls.length,
		durationMs: Math.round(trace.durationMs),
		failures: trace.calls.flatMap(({ failure }) => (failure ? [failure] : [])),
		inputTokens: trace.calls.reduce((sum, call) => sum + call.inputTokens, 0),
		operation: trace.operation,
		outputTokens: trace.calls.reduce(
			(sum, call) => sum + call.outputTokens,
			0,
		),
	}));
	const report = {
		checks,
		generatedAt: new Date().toISOString(),
		operations,
		schemaVersion: 1,
		sentence: SMOKE_SENTENCE,
		suite: options.suite,
	};
	await mkdir(options.artifactDir, { recursive: true });
	const jsonPath = resolve(options.artifactDir, `${options.suite}.json`);
	await writeFile(jsonPath, `${JSON.stringify(report, null, "\t")}\n`);

	for (const check of checks) {
		console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
	}
	for (const operation of operations) {
		console.log(
			`${operation.operation}: ${operation.calls} calls, ${operation.inputTokens}+${operation.outputTokens} tokens, ${operation.durationMs}ms`,
		);
	}
	const passed = checks.filter((check) => check.passed).length;
	console.log(`dumgen acceptance: ${passed}/${checks.length} passed`);
	console.log(`JSON report: ${jsonPath}`);
	if (passed < checks.length) process.exitCode = 1;
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
