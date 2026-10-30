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
	| { readonly kind: "runSplitToPages"; readonly path: string }
	| {
			readonly kind: "runSplitInBlocks";
			readonly path: string;
			readonly selection: string;
	  }
	| {
			readonly kind: "runClassify";
			readonly path: string;
			/** Text that occurs exactly once in the Scroll; it is selected before the command runs. */
			readonly selection: string;
	  }
	| {
			readonly kind: "wrapInLink";
			readonly path: string;
			/**
			 * Text on one line that occurs exactly once in the note: it is
			 * selected and wrapped in `[[ ]]` as typing `[` twice over a
			 * selection does.
			 */
			readonly selection: string;
	  }
	| {
			readonly kind: "clickLink";
			/** A Library-relative note holding a `[[<linkpath>]]` or `[[<linkpath>|…]]` link. */
			readonly path: string;
			/** The link's target, as written, followed as a click on it is. */
			readonly linkpath: string;
	  }
	| {
			/**
			 * Clicks a link the note holds with real DOM mouse events on its
			 * rendered element, so Textfresser's click detector sees it, as
			 * `clickLink`'s `openLinkText` does not.
			 */
			readonly kind: "clickScrollLink";
			/** A Library-relative note holding a `[[<linkpath>]]` or `[[<linkpath>|…]]` link. */
			readonly path: string;
			/** The link's target, as written. */
			readonly linkpath: string;
			/** Which of the note's links to `linkpath`, from 0; needed when it holds several. */
			readonly nth?: number;
			/** Where it is clicked: in Live Preview, as the driver opens notes, or in Reading view. */
			readonly view?: "livePreview" | "reading";
			/** A plain left click, one with Cmd (Ctrl off macOS), or a middle click. */
			readonly press?: "plain" | "mod" | "middle";
			/**
			 * A Library-relative note opened in a split pane beside the Scroll
			 * and made active before the click, so the link is not the active
			 * note's.
			 */
			readonly activeElsewhere?: string;
	  }
	| {
			readonly direction: "next" | "prev";
			readonly kind: "runPageNavigation";
			readonly path: string;
	  }
	| {
			readonly checked: boolean;
			readonly kind: "toggleCodexEntry";
			readonly lineContent: string;
			readonly path: string;
	  }
	| {
			/**
			 * Runs "Reset dictionary from old notes…" and closes its modal
			 * again, clicking nothing in it; `status().dictionaryReset` then
			 * tells what it showed.
			 */
			readonly kind: "openDictionaryReset";
	  }
	| {
			/**
			 * Runs "Reset dictionary from old notes…", clicks Dry run with the
			 * suggested source and waits for its report; with `execute`, then
			 * clicks Execute… on the report and Execute in the confirmation,
			 * and waits for the run to end. Every modal is closed afterwards;
			 * `status().dictionaryResetRun` tells what was shown and done.
			 */
			readonly kind: "dryRunDictionaryReset";
			readonly execute?: boolean;
	  }
	| {
			/**
			 * Runs "Restart Librarian", which rescans the Library and heals it
			 * again as on load, and settles once the restart is done.
			 */
			readonly kind: "restartLibrarian";
	  };

interface ScenarioDefinition {
	/**
	 * dumgen never reaches a provider in desktop E2E: its jev answers every
	 * question from this script, by question id, or by `<stage>:<id>` for
	 * that stage only, which wins over the bare id (stages reuse ids). A
	 * string picks that Choice option and a number is a Noul; anything
	 * unscripted gets the scripted jev's defaults
	 * (`src/managers/dumgen/scripted-jev.ts`).
	 */
	readonly dumgen?: {
		readonly jev: Readonly<Record<string, string | number>>;
		/**
		 * Luna's answers by stage (`canonical`, `emojiDescription`, …): the
		 * first rule whose `when` text occurs in the request's JSON input, or
		 * that has none, answers its `output`. An unanswered request fails,
		 * so Luna stays unreachable unless scripted.
		 */
		readonly luna?: Readonly<
			Record<
				string,
				readonly { readonly when?: string; readonly output: unknown }[]
			>
		>;
		/**
		 * How each provider answers Textfresser's key check (`GET
		 * /v1/models`): an HTTP status and body; 200 when unscripted.
		 */
		readonly keyCheck?: Partial<
			Record<
				"OpenAI" | "TypeSafe",
				{ readonly status: number; readonly body?: string }
			>
		>;
	};
	/**
	 * Deletes the vault-root `Worter/` dictionary before the fixtures, so a
	 * scenario that asserts what Classify creates starts from none, with
	 * the `Worter backup …/` folders and `Dictionary reset ….md` reports a
	 * dictionary reset left beside it.
	 */
	readonly resetDictionary?: boolean;
	/**
	 * Notes the fresh `Worter/` starts with, by path below it, written after
	 * `resetDictionary` (which it needs) and before the fixtures: old notes
	 * for the dictionary reset to read, say.
	 */
	readonly dictionaryFixture?: readonly {
		readonly path: string;
		readonly content: string;
	}[];
	/**
	 * Makes Obsidian create new notes in the vault-root `Worter/` folder for
	 * this scenario, as the user's vault does (`newFileLocation: folder`,
	 * `newFileFolderPath: Worter`), so a click on an unresolved bare link
	 * makes a stray there.
	 */
	readonly newNotesInDictionary?: boolean;
	readonly fixture: readonly ScenarioFixture[];
	readonly id: string;
	/**
	 * Records VAM's Markdown modify observations below this Library-relative
	 * folder, starting after fixtures and startup healing settle.
	 */
	readonly observeModifications?: { readonly path: string };
	/**
	 * Textfresser settings for this scenario only, such as `hideMetadata`;
	 * the driver restores what they replaced when the scenario ends.
	 */
	readonly settings?: Readonly<Record<string, unknown>>;
}

interface ScenarioModification {
	readonly mtime: number;
	/** Library-relative path of the modified Markdown file. */
	readonly path: string;
	readonly size: number;
}

/** What the last Classify handed to its resolver port (#74's `UnitRef`s). */
interface ScenarioClassifyHandoff {
	/** Library-relative path of the classified Scroll. */
	readonly scrollPath: string;
	readonly sentences: readonly {
		readonly sentenceKey: string;
		readonly text: string;
	}[];
	readonly units: readonly {
		readonly ref: {
			readonly sentenceKey: string;
			readonly segments: readonly number[];
		};
		readonly family: string;
		readonly kind: string;
		readonly occurrences: readonly {
			readonly from: number;
			readonly to: number;
			readonly text: string;
		}[];
	}[];
	readonly resolutions: readonly string[];
	/** Per unit: the Reading note it links to, or why it stayed pending. */
	readonly resolved?: readonly (
		| {
				readonly readingPath: string;
				readonly linked: number;
		  }
		| { readonly pending: string }
	)[];
	readonly stats: {
		readonly cachedSentences: number;
		readonly failedSentences: number;
		readonly germanSentences: number;
		readonly segmentedSentences: number;
		readonly touchedSentences: number;
	};
}

/**
 * What the scenario's `openDictionaryReset` showed: the reset modal, with the
 * source folders it offered and the one it pre-selected, or the notice it
 * failed with.
 */
type ScenarioDictionaryReset =
	| {
			readonly kind: "Opened";
			readonly candidates: readonly {
				readonly folder: string;
				readonly notes: number;
				readonly oldNotes: number;
			}[];
			readonly suggested?: string;
	  }
	| { readonly kind: "Failed"; readonly notice: string };

/**
 * What the scenario's `dryRunDictionaryReset` showed and did: the dry run's
 * report modal, with its buttons and key warning, and, with `execute`, how
 * the Execute ended.
 */
interface ScenarioDictionaryResetRun {
	readonly dryRun:
		| {
				readonly kind: "Report";
				readonly source: string;
				readonly actions: readonly string[];
				readonly keyWarning: string | null;
		  }
		| { readonly kind: "Failed"; readonly notice: string };
	readonly execute:
		| { readonly kind: "Refused"; readonly notice: string }
		| {
				readonly kind: "Done";
				readonly reportPath: string;
				readonly cancelled: boolean;
		  }
		| { readonly kind: "Stopped"; readonly notice: string }
		| null;
}

/** How many requests the scenario's scripted dumgen received, by stage. */
interface ScenarioDumgenRequests {
	readonly jev: Readonly<Record<string, number>>;
	readonly luna: Readonly<Record<string, number>>;
}

interface ScenarioStatus {
	readonly activePath: string | null;
	/** Null until a Classify in this scenario succeeds. */
	readonly classify: ScenarioClassifyHandoff | null;
	/** Null until `openDictionaryReset` runs in this scenario. */
	readonly dictionaryReset: ScenarioDictionaryReset | null;
	/** Null until `dryRunDictionaryReset` runs in this scenario. */
	readonly dictionaryResetRun: ScenarioDictionaryResetRun | null;
	readonly dumgenRequests: ScenarioDumgenRequests | null;
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
	/** The vault-root `Worter/` notes, by vault path, once settled. */
	readonly dictionary: () => Promise<{
		readonly markdown: Readonly<Record<string, string>>;
	}>;
	/** Settled modify observations; requires `observeModifications`. */
	readonly modifications: () => Promise<readonly ScenarioModification[]>;
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
	readonly activePath: string | null;
	readonly classify?: ScenarioClassifyHandoff | null;
	readonly dictionaryReset?: ScenarioDictionaryReset | null;
	readonly dictionaryResetRun?: ScenarioDictionaryResetRun | null;
	readonly dumgenRequests?: ScenarioDumgenRequests | null;
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
		const response = await this.#cli
			.json<DriverEnvelope>(
				[this.#manifest.driverCommand, `request=${encoded}`],
				{ timeoutMs: REQUEST_TIMEOUT_MS },
			)
			.catch((error: unknown) => {
				// Every driver wait gives up within 30 s and answers an error,
				// so a CLI timeout means the answer never came back. Name the
				// request: a mutation may have run, and is never retried.
				if (error instanceof HarnessError && error.code === "CLI_TIMEOUT")
					throw new HarnessError(
						"CLI_TIMEOUT",
						`Driver ${method}${isRecord(params.operation) ? ` ${String(params.operation.kind)}` : ""} got no answer through obsidian-cli within ${REQUEST_TIMEOUT_MS} ms`,
						error.details,
					);
				throw error;
			});

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
		case "runSplitInBlocks":
			return {
				kind: "splitInBlocks",
				path: action.path,
				selection: action.selection,
			};
		case "runClassify":
			return {
				kind: "classify",
				path: action.path,
				selection: action.selection,
			};
		case "wrapInLink":
			return {
				kind: "wrapLink",
				path: action.path,
				selection: action.selection,
			};
		case "clickLink":
			return {
				kind: "followLink",
				linkpath: action.linkpath,
				path: action.path,
			};
		case "clickScrollLink":
			return {
				...(action.activeElsewhere === undefined
					? {}
					: { activeElsewhere: action.activeElsewhere }),
				kind: "clickScrollLink",
				linkpath: action.linkpath,
				...(action.nth === undefined ? {} : { nth: action.nth }),
				path: action.path,
				press: action.press ?? "plain",
				view: action.view ?? "livePreview",
			};
		case "runPageNavigation":
			return {
				direction: action.direction,
				kind: "pageNavigation",
				path: action.path,
			};
		case "toggleCodexEntry":
			return {
				checked: action.checked,
				kind: "toggleCodexEntry",
				lineContent: action.lineContent,
				path: action.path,
			};
		case "openDictionaryReset":
			return { kind: "openDictionaryReset" };
		case "dryRunDictionaryReset":
			return {
				execute: action.execute ?? false,
				kind: "dryRunDictionaryReset",
			};
		case "restartLibrarian":
			return { kind: "restartLibrarian" };
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
				...(definition.dumgen ? { dumgen: definition.dumgen } : {}),
				fixtures: definition.fixture.map(encodeFixture),
				...(definition.observeModifications
					? { observeModifications: definition.observeModifications }
					: {}),
				...(definition.resetDictionary ? { resetDictionary: true } : {}),
				...(definition.dictionaryFixture
					? { dictionaryFixture: definition.dictionaryFixture }
					: {}),
				...(definition.newNotesInDictionary
					? { newNotesInDictionary: true }
					: {}),
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
			async dictionary() {
				const result = await client!.request<{
					readonly markdown: Readonly<Record<string, string>>;
				}>("dictionary", {}, fence);
				return { markdown: result.value.markdown };
			},
			async modifications() {
				const result = await client!.request<{
					readonly modifications: readonly ScenarioModification[];
				}>("modifications", {}, fence);
				return result.value.modifications;
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
					activePath: result.value.activePath,
					classify: result.value.classify ?? null,
					dictionaryReset: result.value.dictionaryReset ?? null,
					dictionaryResetRun: result.value.dictionaryResetRun ?? null,
					dumgenRequests: result.value.dumgenRequests ?? null,
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
