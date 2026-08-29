import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ObsidianCli } from "./infra/cli";
import { HarnessError } from "./infra/errors";
import type { ObsidianE2eSessionManifest } from "./infra/session";

const PROTOCOL_VERSION = 1 as const;
const REQUEST_TIMEOUT_MS = 45_000;

type ScenarioFixture =
	| { readonly content: string; readonly path: string }
	| { readonly bytes: readonly number[]; readonly path: string };

type ScenarioAction =
	| { readonly content: string; readonly kind: "createFile"; readonly path: string }
	| { readonly bytes: readonly number[]; readonly kind: "createBinary"; readonly path: string }
	| { readonly content: string; readonly kind: "modifyFile"; readonly path: string }
	| { readonly from: string; readonly kind: "renamePath"; readonly to: string }
	| { readonly kind: "deletePath"; readonly path: string }
	| { readonly kind: "runSplitToPages"; readonly path: string };

interface ScenarioDefinition {
	readonly fixture: readonly ScenarioFixture[];
	readonly id: string;
	readonly settings?: Readonly<Record<string, unknown>>;
}

interface ScenarioStatus {
	readonly generation: number;
	readonly instanceId: string;
	readonly root: string;
	readonly scenarioId: string;
}

interface ScenarioSnapshot {
	readonly files: readonly {
		readonly kind: "file" | "md";
		readonly path: string;
	}[];
	readonly markdown: Readonly<Record<string, string>>;
	readonly root: string;
}

interface ScenarioActionReceipt {
	readonly affectedPaths: readonly string[];
	readonly generation: number;
	readonly instanceId: string;
	readonly kind: string;
	readonly operationId: string;
}

interface ObsidianScenario {
	readonly act: (action: ScenarioAction) => Promise<void>;
	readonly snapshot: () => Promise<ScenarioSnapshot>;
	readonly status: () => Promise<ScenarioStatus>;
}

interface LifecycleFence {
	readonly generation: number;
	readonly instanceId: string;
}

interface DriverErrorBody {
	readonly details?: unknown;
	readonly diagnosticsId?: unknown;
	readonly kind?: unknown;
	readonly message?: unknown;
}

interface DriverEnvelope {
	readonly error?: DriverErrorBody;
	readonly generation?: unknown;
	readonly instanceId?: unknown;
	readonly ok?: unknown;
	readonly protocol?: unknown;
	readonly requestId?: unknown;
	readonly sessionId?: unknown;
	readonly value?: unknown;
}

interface ActiveScenarioValue {
	readonly libraryRoot: string;
	readonly scenarioId: string;
	readonly scenarioRoot: string;
}

interface DriverStatusValue {
	readonly scenario: ActiveScenarioValue | null;
}

interface DriverSnapshotValue {
	readonly files: readonly {
		readonly kind: "binary" | "markdown";
		readonly path: string;
	}[];
	readonly markdown: Readonly<Record<string, string>>;
	readonly root: string;
}

interface DriverActionReceipt extends ScenarioActionReceipt {}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new HarnessError("CLI_PROTOCOL", `${label} must be a non-empty string`);
	}
	return value;
}

function requireGeneration(value: unknown): number {
	if (!Number.isSafeInteger(value) || (value as number) < 1) {
		throw new HarnessError(
			"CLI_PROTOCOL",
			"Driver response generation must be a positive safe integer",
		);
	}
	return value as number;
}

function validateManifest(value: unknown): ObsidianE2eSessionManifest {
	if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION) {
		throw new HarnessError(
			"SESSION_INVALID",
			`OBSIDIAN_E2E_SESSION_MANIFEST must use protocol ${PROTOCOL_VERSION}`,
		);
	}
	const manifest = value as unknown as ObsidianE2eSessionManifest;
	for (const key of [
		"artifactDir",
		"cliPath",
		"driverCommand",
		"sessionId",
		"vaultName",
		"vaultPath",
	] as const) {
		requireString(manifest[key], `session.${key}`);
	}
	if (manifest.driverCommand !== "textfresser-e2e") {
		throw new HarnessError(
			"SESSION_INVALID",
			`Unsupported driver command '${manifest.driverCommand}'`,
		);
	}
	if (
		process.env.OBSIDIAN_E2E_SESSION_ID &&
		process.env.OBSIDIAN_E2E_SESSION_ID !== manifest.sessionId
	) {
		throw new HarnessError(
			"SESSION_INVALID",
			"Session manifest does not match OBSIDIAN_E2E_SESSION_ID",
		);
	}
	return manifest;
}

async function loadManifest(): Promise<ObsidianE2eSessionManifest> {
	const path = process.env.OBSIDIAN_E2E_SESSION_MANIFEST;
	if (!path) {
		throw new HarnessError(
			"SESSION_INVALID",
			"Run desktop scenarios through `bun run test:obsidian-e2e`; the outer runner supplies OBSIDIAN_E2E_SESSION_MANIFEST.",
		);
	}
	try {
		return validateManifest(JSON.parse(await readFile(resolve(path), "utf8")));
	} catch (error) {
		if (error instanceof HarnessError) throw error;
		throw new HarnessError(
			"SESSION_INVALID",
			`Could not read Obsidian E2E session manifest ${path}`,
			{ cause: error },
		);
	}
}

class DriverClient {
	readonly #cli: ObsidianCli;
	readonly #manifest: ObsidianE2eSessionManifest;

	constructor(manifest: ObsidianE2eSessionManifest) {
		this.#manifest = manifest;
		this.#cli = new ObsidianCli({
			cliPath: manifest.cliPath,
			vaultName: manifest.vaultName,
		});
	}

	get artifactDir(): string {
		return this.#manifest.artifactDir;
	}

	async request<T>(
		method: string,
		params: Readonly<Record<string, unknown>>,
		fence?: LifecycleFence,
	): Promise<{ readonly fence: LifecycleFence; readonly value: T }> {
		const requestId = randomUUID();
		const request = {
			expectedGeneration: fence?.generation,
			expectedInstanceId: fence?.instanceId,
			method,
			params,
			protocol: PROTOCOL_VERSION,
			requestId,
			sessionId: this.#manifest.sessionId,
		};
		const encoded = Buffer.from(JSON.stringify(request), "utf8").toString(
			"base64url",
		);
		const response = await this.#cli.json<DriverEnvelope>(
			[this.#manifest.driverCommand, `request=${encoded}`],
			{ timeoutMs: REQUEST_TIMEOUT_MS },
		);

		if (
			response.protocol !== PROTOCOL_VERSION ||
			response.sessionId !== this.#manifest.sessionId ||
			response.requestId !== requestId
		) {
			throw new HarnessError(
				"CLI_PROTOCOL",
				`Driver returned an envelope for the wrong protocol, session, or request: ${JSON.stringify(response)}`,
			);
		}
		const nextFence = {
			generation: requireGeneration(response.generation),
			instanceId: requireString(response.instanceId, "response.instanceId"),
		};
		if (response.ok !== true) {
			const kind = requireString(response.error?.kind, "response.error.kind");
			const message = requireString(
				response.error?.message,
				"response.error.message",
			);
			throw new HarnessError(
				"CLI_PROTOCOL",
				`Driver ${method} failed [${kind}]: ${message}`,
				{ stdout: JSON.stringify(response.error) },
			);
		}
		if (
			fence &&
			(nextFence.instanceId !== fence.instanceId ||
				nextFence.generation !== fence.generation)
		) {
			throw new HarnessError(
				"CLI_PROTOCOL",
				`Textfresser lifecycle changed during ${method}; refusing a stale result`,
				{ stdout: JSON.stringify({ expected: fence, received: nextFence }) },
			);
		}
		return { fence: nextFence, value: response.value as T };
	}
}

let scenarioTail: Promise<void> = Promise.resolve();

function encodeBytes(bytes: readonly number[], label: string): string {
	if (!bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
		throw new HarnessError(
			"SESSION_INVALID",
			`${label} must contain only integer bytes from 0 through 255`,
		);
	}
	return Buffer.from(bytes).toString("base64");
}

function encodeFixture(
	fixture: ScenarioFixture,
): Readonly<Record<string, unknown>> {
	if ("content" in fixture) {
		return {
			content: fixture.content,
			encoding: "utf8",
			path: fixture.path,
		};
	}
	return {
		content: encodeBytes(fixture.bytes, "fixture.bytes"),
		encoding: "base64",
		path: fixture.path,
	};
}

function encodeAction(action: ScenarioAction): Readonly<Record<string, unknown>> {
	switch (action.kind) {
		case "createFile":
			return {
				content: action.content,
				encoding: "utf8",
				kind: "create",
				path: action.path,
			};
		case "createBinary":
			return {
				content: encodeBytes(action.bytes, "action.bytes"),
				encoding: "base64",
				kind: "create",
				path: action.path,
			};
		case "modifyFile":
			return {
				content: action.content,
				encoding: "utf8",
				kind: "modify",
				path: action.path,
			};
		case "renamePath":
			return { kind: "rename", path: action.from, to: action.to };
		case "deletePath":
			return { kind: "delete", path: action.path };
		case "runSplitToPages":
			return { kind: "splitToPages", path: action.path };
	}
}

function validateActiveScenario(
	value: unknown,
	expectedId: string,
): ActiveScenarioValue {
	if (
		!isRecord(value) ||
		value.scenarioId !== expectedId ||
		typeof value.scenarioRoot !== "string" ||
		typeof value.libraryRoot !== "string"
	) {
		throw new HarnessError(
			"CLI_PROTOCOL",
			`Driver did not activate scenario '${expectedId}'`,
		);
	}
	return value as unknown as ActiveScenarioValue;
}

async function captureScenarioFailure(
	client: DriverClient,
	definition: ScenarioDefinition,
	fence: LifecycleFence,
): Promise<void> {
	const failureDir = resolve(client.artifactDir, "failure");
	await mkdir(failureDir, { recursive: true });
	const safeId = definition.id.replace(/[^A-Za-z0-9._-]/gu, "_");
	const evidence: Record<string, unknown> = {
		capturedAt: new Date().toISOString(),
		scenarioId: definition.id,
	};
	try {
		evidence.diagnostics = (
			await client.request<unknown>("diagnostics", {}, fence)
		).value;
	} catch (error) {
		evidence.diagnosticsError = String(error);
	}
	try {
		evidence.snapshot = (
			await client.request<unknown>("snapshot", { scope: "library" }, fence)
		).value;
	} catch (error) {
		evidence.snapshotError = String(error);
	}
	await writeFile(
		resolve(failureDir, `${safeId}-driver.json`),
		`${JSON.stringify(evidence, null, 2)}\n`,
		"utf8",
	);
}

/**
 * Runs one isolated desktop-host story. The outer runner owns Obsidian; this
 * function owns the scenario root, lifecycle fence, settling, and cleanup.
 */
export async function withObsidianScenario<T>(
	definition: ScenarioDefinition,
	run: (scenario: ObsidianScenario) => Promise<T>,
): Promise<T> {
	const prior = scenarioTail;
	let release!: () => void;
	scenarioTail = new Promise<void>((resolveTail) => {
		release = resolveTail;
	});
	await prior;

	let client: DriverClient | undefined;
	let fence: LifecycleFence | undefined;
	let callbackError: unknown;
	try {
		client = new DriverClient(await loadManifest());
		const ready = await client.request<unknown>("ready", {});
		fence = ready.fence;
		const begun = await client.request<unknown>(
			"beginScenario",
			{
				fixtures: definition.fixture.map(encodeFixture),
				scenarioId: definition.id,
				settings: definition.settings ?? {},
			},
			fence,
		);
		fence = begun.fence;
		validateActiveScenario(begun.value, definition.id);

		return await run({
			async act(action) {
				await client!.request<DriverActionReceipt>(
					"act",
					{ operation: encodeAction(action), settle: true },
					fence,
				);
			},
			async snapshot() {
				const result = await client!.request<DriverSnapshotValue>(
					"snapshot",
					{ scope: "library" },
					fence,
				);
				return {
					files: result.value.files.map(({ kind, path }) => ({
						kind: kind === "markdown" ? "md" : "file",
						path,
					})),
					markdown: result.value.markdown,
					root: "Library",
				};
			},
			async status() {
				const result = await client!.request<DriverStatusValue>(
					"status",
					{},
					fence,
				);
				const scenario = validateActiveScenario(
					result.value.scenario,
					definition.id,
				);
				return {
					generation: result.fence.generation,
					instanceId: result.fence.instanceId,
					root: scenario.libraryRoot,
					scenarioId: scenario.scenarioId,
				};
			},
		});
	} catch (error) {
		callbackError = error;
		if (client && fence) {
			await captureScenarioFailure(client, definition, fence).catch(() => undefined);
		}
		throw error;
	} finally {
		try {
			if (client && fence) {
				await client.request("cleanupSession", {}, fence);
			}
		} catch (cleanupError) {
			if (callbackError === undefined) throw cleanupError;
		} finally {
			release();
		}
	}
}
