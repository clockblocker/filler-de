"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { apiVersion, MarkdownView, Plugin, TFile, TFolder } = require("obsidian");
const {
	PROTOCOL_VERSION,
	ProtocolError,
	isRecord,
	parseEncodedRequest,
	requestFingerprint,
	resolveScopedPath,
	scenarioPaths,
	validateDriverConfig,
	validateRelativePath,
	validateScenarioId,
	validateScope,
	validateScriptedJevAnswers,
	validateScriptedKeyCheck,
	validateScriptedLunaAnswers,
} = require("./protocol");

const TARGET_PLUGIN_ID = "cbcr-text-eater-de";
/** By active scenario: what its `openDictionaryReset` showed. */
const dictionaryResetOpenings = new WeakMap();
/** By active scenario: what its `dryRunDictionaryReset` showed and did. */
const dictionaryResetRuns = new WeakMap();
/** Where Textfresser keeps its Lemma notes, at the vault root (ADR 0013). */
const DICTIONARY_ROOT = "Worter";
/** The file, in the vault's config folder, that marks a vault as E2E-only. */
const E2E_VAULT_MARKER = "textfresser-e2e-vault";
const CLI_COMMAND = "textfresser-e2e";
const CACHE_LIMIT = 256;
const GLOBAL_STATE_KEY = Symbol.for("textfresser.e2e.driver.state.v1");
const SESSION_MARKER_KEY = "__TEXTFRESSER_E2E_DRIVER_SESSION_V1";

class DriverError extends Error {
	constructor(kind, message, details) {
		super(message);
		this.name = "DriverError";
		this.kind = kind;
		this.details = details;
	}
}

function createId(prefix) {
	let id;
	try {
		id = randomUUID();
	} catch {
		id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	}
	return `${prefix}-${id}`;
}

function getGlobalState() {
	const current = globalThis[GLOBAL_STATE_KEY];
	if (current?.protocol === PROTOCOL_VERSION) return current;

	const state = {
		activeScenarios: new Map(),
		operationSequence: 0,
		protocol: PROTOCOL_VERSION,
		requestCache: new Map(),
		textfresser: {
			generation: 0,
			instanceId: "unavailable",
			ref: null,
		},
	};
	globalThis[GLOBAL_STATE_KEY] = state;
	return state;
}

function sleep(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clampTimeout(value, fallback) {
	if (value === undefined) return fallback;
	if (!Number.isSafeInteger(value) || value < 100 || value > 120_000) {
		throw new DriverError(
			"InvalidTimeout",
			"timeoutMs must be an integer between 100 and 120000",
		);
	}
	return value;
}

async function withTimeout(promise, timeoutMs, label) {
	let timeout;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timeout = setTimeout(() => {
					reject(
						new DriverError(
							"Timeout",
							`${label} did not complete within ${timeoutMs}ms`,
						),
					);
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeout !== undefined) clearTimeout(timeout);
	}
}

function pruneRequestCache(state) {
	if (state.requestCache.size <= CACHE_LIMIT) return;
	for (const [key, entry] of state.requestCache) {
		if (state.requestCache.size <= CACHE_LIMIT) break;
		if (entry.pending === true) continue;
		state.requestCache.delete(key);
	}
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

function encodeArrayBuffer(buffer) {
	return Buffer.from(buffer).toString("base64");
}

function decodeBase64(value, label) {
	if (typeof value !== "string") {
		throw new DriverError("InvalidOperation", `${label} must be a string`);
	}
	if (
		value.length % 4 === 1 ||
		!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
			value,
		)
	) {
		throw new DriverError(
			"InvalidOperation",
			`${label} must be canonical padded base64`,
		);
	}
	const bytes = Buffer.from(value, "base64");
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	);
}

function assertBoolean(value, label, fallback) {
	if (value === undefined) return fallback;
	if (typeof value !== "boolean") {
		throw new DriverError("InvalidRequest", `${label} must be a boolean`);
	}
	return value;
}

function assertString(value, label, options = {}) {
	if (typeof value !== "string") {
		throw new DriverError("InvalidRequest", `${label} must be a string`);
	}
	const minimum = options.allowEmpty === true ? 0 : 1;
	const maximum = options.maxLength ?? 1024 * 1024;
	if (value.length < minimum || value.length > maximum) {
		throw new DriverError(
			"InvalidRequest",
			`${label} must contain between ${minimum} and ${maximum} characters`,
		);
	}
	return value;
}

function assertRecord(value, label) {
	if (!isRecord(value)) {
		throw new DriverError("InvalidRequest", `${label} must be a JSON object`);
	}
	return value;
}

function sanitizeSettings(value) {
	if (value === undefined) return {};
	const settings = assertRecord(value, "params.settings");
	const sanitized = {};
	const booleanKeys = new Set([
		"showScrollBacklinks",
		"hideMetadata",
	]);
	const integerKeys = new Set([
		"maxSectionDepth",
		"showScrollsInCodexesForDepth",
	]);
	const placementKeys = new Set([
		"translatePlacement",
		"splitInBlocksPlacement",
		"explainGrammarPlacement",
		"generatePlacement",
	]);
	const placements = new Set(["AboveSelection", "Bottom", "ShortcutOnly"]);

	for (const [key, setting] of Object.entries(settings)) {
		if (booleanKeys.has(key)) {
			if (typeof setting !== "boolean") {
				throw new DriverError(
					"InvalidSettings",
					`params.settings.${key} must be a boolean`,
				);
			}
			sanitized[key] = setting;
			continue;
		}
		if (integerKeys.has(key)) {
			if (!Number.isSafeInteger(setting) || setting < 0 || setting > 100) {
				throw new DriverError(
					"InvalidSettings",
					`params.settings.${key} must be an integer from 0 to 100`,
				);
			}
			sanitized[key] = setting;
			continue;
		}
		if (placementKeys.has(key)) {
			if (!placements.has(setting)) {
				throw new DriverError(
					"InvalidSettings",
					`params.settings.${key} must be AboveSelection, Bottom, or ShortcutOnly`,
				);
			}
			sanitized[key] = setting;
			continue;
		}
		if (key === "navButtonsPosition") {
			if (setting !== "left" && setting !== "right") {
				throw new DriverError(
					"InvalidSettings",
					"params.settings.navButtonsPosition must be 'left' or 'right'",
				);
			}
			sanitized[key] = setting;
			continue;
		}
		if (key === "suffixDelimiter") {
			const delimiter = assertRecord(
				setting,
				"params.settings.suffixDelimiter",
			);
			const symbol = assertString(
				delimiter.symbol,
				"params.settings.suffixDelimiter.symbol",
				{ maxLength: 8 },
			);
			if (typeof delimiter.padded !== "boolean") {
				throw new DriverError(
					"InvalidSettings",
					"params.settings.suffixDelimiter.padded must be a boolean",
				);
			}
			sanitized[key] = { padded: delimiter.padded, symbol };
			continue;
		}
		if (key === "languages") {
			const languages = assertRecord(setting, "params.settings.languages");
			sanitized[key] = {
				known: assertString(
					languages.known,
					"params.settings.languages.known",
					{ maxLength: 64 },
				),
				target: assertString(
					languages.target,
					"params.settings.languages.target",
					{ maxLength: 64 },
				),
			};
			continue;
		}
		throw new DriverError(
			"InvalidSettings",
			`params.settings.${key} is not allowed in desktop E2E tests`,
			{
				allowed: [
					...booleanKeys,
					...integerKeys,
					...placementKeys,
					"navButtonsPosition",
					"suffixDelimiter",
					"languages",
				],
			},
		);
	}
	return sanitized;
}

function isFolder(value) {
	return value instanceof TFolder || Array.isArray(value?.children);
}

function isFile(value) {
	return value instanceof TFile || (!!value && !isFolder(value) && !!value.stat);
}

async function ensureFolder(vault, folderPath) {
	const normalized = validateRelativePath(folderPath, "internal folder path");
	const segments = normalized.split("/");
	for (let index = 1; index <= segments.length; index += 1) {
		const candidate = segments.slice(0, index).join("/");
		const existing = vault.getAbstractFileByPath(candidate);
		if (existing) {
			if (!isFolder(existing)) {
				throw new DriverError(
					"PathCollision",
					`cannot create folder '${candidate}' because a file exists there`,
				);
			}
			continue;
		}
		await vault.createFolder(candidate);
	}
}

async function ensureParentFolder(vault, filePath) {
	const slash = filePath.lastIndexOf("/");
	if (slash === -1) return;
	await ensureFolder(vault, filePath.slice(0, slash));
}

async function openSourceEditor(app, file) {
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
	app.workspace.setActiveLeaf(leaf, { focus: true });
	const prior = leaf.getViewState();
	await leaf.setViewState({
		...prior,
		active: true,
		state: {
			...prior.state,
			file: file.path,
			mode: "source",
			source: false,
		},
		type: "markdown",
	});
	app.workspace.setActiveLeaf(leaf, { focus: true });
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (view?.file !== file || view.getMode() !== "source") {
		throw new DriverError(
			"EditorUnavailable",
			`source editor for '${file.path}' did not become active`,
		);
	}
	view.editor.focus();
	return view.editor;
}

/**
 * Saves the active editor when its content differs from its note on disk.
 * Textfresser writes into an open note through its editor, and Obsidian
 * saves an editor about two seconds after its last change, so without this
 * a disk read after the plugin settles races that save.
 */
async function persistActiveEditor(app) {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!file || !isFile(file)) return;
	if (view.editor.getValue() === (await app.vault.read(file))) return;
	await view.save();
}

function relativeTo(base, fullPath) {
	if (fullPath === base) return "";
	if (!fullPath.startsWith(`${base}/`)) {
		throw new DriverError(
			"PathOutsideScenario",
			`path '${fullPath}' is outside snapshot root '${base}'`,
		);
	}
	return fullPath.slice(base.length + 1);
}

class TextfresserE2EDriver extends Plugin {
	onload() {
		this.driverInstanceId = createId("driver");
		this.loadedAt = new Date().toISOString();
		this.config = null;
		this.configError = null;
		this.globalState = getGlobalState();

		// This must happen before the first await. Textfresser checks it while its
		// modules initialize so E2E-only pending-work accounting is enabled.
		this.previousE2eMode = globalThis.__E2E_MODE;
		this.sessionMarker = {
			driverInstanceId: this.driverInstanceId,
			loadedAt: this.loadedAt,
			sessionId: null,
		};
		globalThis[SESSION_MARKER_KEY] = this.sessionMarker;
		globalThis.__E2E_MODE = true;

		if (typeof this.registerCliHandler !== "function") {
			throw new Error(
				"Textfresser E2E Driver requires Obsidian 1.12.2+ because registerCliHandler is unavailable",
			);
		}

		this.registerCliHandler(
			CLI_COMMAND,
			"Execute one versioned, session-scoped Textfresser E2E request",
			{
				request: {
					description: "Unpadded base64url JSON request envelope",
					required: true,
					value: "<base64url-json>",
				},
			},
			(params) => this.handleCliRequest(params),
		);

		// Register the handler before starting I/O. This keeps the command visible
		// throughout startup; requests wait for the same configuration promise.
		this.configReady = this.loadConfiguration();
		return this.configReady;
	}

	async loadConfiguration() {
		try {
			this.config = validateDriverConfig(await this.loadData());
			this.sessionMarker.sessionId = this.config.sessionId;
		} catch (error) {
			this.configError = error;
		}
	}

	onunload() {
		if (globalThis[SESSION_MARKER_KEY] !== this.sessionMarker) return;
		delete globalThis[SESSION_MARKER_KEY];
		if (globalThis.__E2E_MODE === true) {
			if (this.previousE2eMode === undefined) delete globalThis.__E2E_MODE;
			else globalThis.__E2E_MODE = this.previousE2eMode;
		}
	}

	observeTextfresser() {
		const plugin = this.app.plugins?.plugins?.[TARGET_PLUGIN_ID] ?? null;
		const lifecycle = this.globalState.textfresser;
		const previous = lifecycle.ref?.deref?.() ?? null;
		if (plugin && plugin !== previous) {
			lifecycle.generation += 1;
			lifecycle.instanceId = createId("textfresser");
			lifecycle.ref =
				typeof WeakRef === "function" ? new WeakRef(plugin) : { deref: () => plugin };
		}
		return {
			plugin,
			status: {
				generation: lifecycle.generation,
				hasResetSettingsForTesting:
					typeof plugin?.resetSettingsForTesting === "function",
				hasWhenIdle: typeof plugin?.whenIdle === "function",
				initialized: plugin?.initialized === true,
				instanceId: lifecycle.instanceId,
				loaded: plugin !== null,
				pluginId: TARGET_PLUGIN_ID,
			},
		};
	}

	/**
	 * What Textfresser's last Classify handed to its resolver port, with the
	 * Scroll path relative to the scenario's library. Null before any
	 * Classify, or for a Scroll outside the scenario.
	 */
	classifyHandoff(scenario) {
		const plugin = this.observeTextfresser().plugin;
		const handoff = plugin?.getClassifyTestingApi?.().latestHandoff() ?? null;
		if (
			!scenario ||
			!handoff ||
			!handoff.scrollPath.startsWith(`${scenario.libraryRoot}/`)
		) {
			return null;
		}
		return {
			...handoff,
			scrollPath: relativeTo(scenario.libraryRoot, handoff.scrollPath),
		};
	}

	activeScenario() {
		if (!this.config) return null;
		return this.globalState.activeScenarios.get(this.config.sessionId) ?? null;
	}

	statusValue() {
		const lifecycle = this.observeTextfresser().status;
		const scenario = this.activeScenario();
		const activeFile = this.app.workspace.getActiveFile();
		const activePath =
			scenario &&
			activeFile &&
			activeFile.path.startsWith(`${scenario.libraryRoot}/`)
				? relativeTo(scenario.libraryRoot, activeFile.path)
				: null;
		const classifyApi = this.observeTextfresser().plugin?.getClassifyTestingApi?.();
		return {
			activePath,
			classify: this.classifyHandoff(scenario),
			dictionaryReset:
				(scenario && dictionaryResetOpenings.get(scenario)) ?? null,
			dictionaryResetRun:
				(scenario && dictionaryResetRuns.get(scenario)) ?? null,
			driver: {
				configured: this.config !== null,
				instanceId: this.driverInstanceId,
				loadedAt: this.loadedAt,
				pluginId: this.manifest.id,
				protocol: PROTOCOL_VERSION,
				sessionId: this.config?.sessionId ?? null,
			},
			dumgenRequests: classifyApi?.dumgenRequests?.() ?? null,
			scenario,
			textfresser: lifecycle,
		};
	}

	errorEnvelope(error, request) {
		const lifecycle = this.observeTextfresser().status;
		const kind =
			typeof error?.kind === "string" ? error.kind : "UnexpectedDriverError";
		const message =
			error instanceof Error ? error.message : `Unexpected error: ${String(error)}`;
		return {
			error: {
				details: error?.details,
				diagnosticsId: createId("diagnostics"),
				kind,
				message,
				stack: error instanceof Error ? error.stack : undefined,
			},
			generation: lifecycle.generation,
			instanceId: lifecycle.instanceId,
			ok: false,
			protocol: PROTOCOL_VERSION,
			requestId: request?.requestId ?? null,
			sessionId: request?.sessionId ?? this.config?.sessionId ?? "unknown",
		};
	}

	successEnvelope(request, value) {
		const lifecycle = this.observeTextfresser().status;
		return {
			generation: lifecycle.generation,
			instanceId: lifecycle.instanceId,
			ok: true,
			protocol: PROTOCOL_VERSION,
			requestId: request.requestId,
			sessionId: request.sessionId,
			value,
		};
	}

	async handleCliRequest(params) {
		let request;
		try {
			await this.configReady;
			if (!params || typeof params.request !== "string") {
				throw new ProtocolError(
					"MissingRequest",
					"CLI flag request=<base64url-json> is required",
				);
			}
			request = parseEncodedRequest(params.request);

			if (this.configError) {
				throw new DriverError(
					"DriverConfigurationError",
					`driver data.json is invalid: ${this.configError.message}`,
				);
			}
			if (!this.config) {
				throw new DriverError(
					"DriverConfigurationError",
					"driver data.json did not load",
				);
			}
			if (request.sessionId !== this.config.sessionId) {
				throw new DriverError(
					"SessionMismatch",
					`request session '${request.sessionId}' does not match driver session '${this.config.sessionId}'`,
				);
			}

			const cacheKey = `${request.sessionId}:${request.requestId}`;
			const fingerprint = requestFingerprint(request);
			const existing = this.globalState.requestCache.get(cacheKey);
			if (existing) {
				if (existing.fingerprint !== fingerprint) {
					throw new DriverError(
						"RequestIdConflict",
						`requestId '${request.requestId}' was already used for a different request; choose a new requestId`,
					);
				}
				return await existing.promise;
			}

			const cacheEntry = {
				fingerprint,
				pending: true,
				promise: null,
			};
			cacheEntry.promise = this.dispatchToEnvelope(request).then((envelope) => {
				cacheEntry.pending = false;
				return JSON.stringify(envelope);
			});
			this.globalState.requestCache.set(cacheKey, cacheEntry);
			pruneRequestCache(this.globalState);
			return await cacheEntry.promise;
		} catch (error) {
			return JSON.stringify(this.errorEnvelope(error, request));
		}
	}

	async dispatchToEnvelope(request) {
		try {
			const value = await this.dispatch(request);
			return this.successEnvelope(request, value);
		} catch (error) {
			return this.errorEnvelope(error, request);
		}
	}

	async dispatch(request) {
		switch (request.method) {
			case "status":
				return this.statusValue();
			case "ready":
				return await this.ready(request.params);
			case "beginScenario":
				return await this.beginScenario(request);
			case "act":
				return await this.act(request);
			case "settle":
				return await this.settle(request.params);
			case "snapshot":
				return await this.snapshot(request.params);
			case "modifications":
				return await this.modifications(request.params);
			case "diagnostics":
				return this.diagnostics();
			case "dictionary":
				return await this.dictionary();
			case "cleanupSession":
				return await this.cleanupSession(request);
			default:
				throw new DriverError(
					"UnknownMethod",
					`unsupported request method '${request.method}'`,
				);
		}
	}

	assertLifecycleFence(request, observation) {
		const { plugin, status } = observation ?? this.observeTextfresser();
		if (!plugin) {
			throw new DriverError(
				"TextfresserNotLoaded",
				`target plugin '${TARGET_PLUGIN_ID}' is not loaded`,
				{ status },
			);
		}
		if (request.expectedInstanceId !== status.instanceId) {
			throw new DriverError(
				"TextfresserInstanceMismatch",
				`expected Textfresser instance '${request.expectedInstanceId}', found '${status.instanceId}'`,
				{ actual: status.instanceId, expected: request.expectedInstanceId },
			);
		}
		if (request.expectedGeneration !== status.generation) {
			throw new DriverError(
				"TextfresserGenerationMismatch",
				`expected Textfresser generation ${request.expectedGeneration}, found ${status.generation}`,
				{ actual: status.generation, expected: request.expectedGeneration },
			);
		}
		this.assertTargetReady(observation);
		return observation;
	}

	assertTargetReady(observation) {
		const { plugin, status } = observation ?? this.observeTextfresser();
		if (!plugin) {
			throw new DriverError(
				"TextfresserNotLoaded",
				`target plugin '${TARGET_PLUGIN_ID}' is not loaded`,
				{ status },
			);
		}
		if (!status.initialized) {
			throw new DriverError(
				"TextfresserNotInitialized",
				"Textfresser is loaded but has not completed initialization",
				{ status },
			);
		}
		if (!status.hasWhenIdle) {
			throw new DriverError(
				"TextfresserProbeMissing",
				"Textfresser does not expose whenIdle(); install the E2E-compatible production artifact",
				{ status },
			);
		}
		return observation;
	}

	async ready(params) {
		const timeoutMs = clampTimeout(params.timeoutMs, 30_000);
		const stabilityMs =
			params.stabilityMs === undefined ? 250 : params.stabilityMs;
		if (
			!Number.isSafeInteger(stabilityMs) ||
			stabilityMs < 0 ||
			stabilityMs > 5_000
		) {
			throw new DriverError(
				"InvalidTimeout",
				"stabilityMs must be an integer between 0 and 5000",
			);
		}

		const deadline = Date.now() + timeoutMs;
		let candidate = null;
		let stableSince = 0;
		while (Date.now() < deadline) {
			const observation = this.observeTextfresser();
			if (
				observation.plugin &&
				observation.status.initialized &&
				observation.status.hasWhenIdle &&
				observation.status.hasResetSettingsForTesting
			) {
				if (observation.plugin !== candidate) {
					candidate = observation.plugin;
					stableSince = Date.now();
				} else if (Date.now() - stableSince >= stabilityMs) {
					const remaining = Math.max(100, deadline - Date.now());
					await this.settle({ timeoutMs: remaining });
					const after = this.observeTextfresser();
					if (after.plugin !== candidate) {
						candidate = null;
						stableSince = 0;
						continue;
					}
					return this.statusValue();
				}
			} else {
				candidate = null;
				stableSince = 0;
			}
			await sleep(50);
		}
		throw new DriverError(
			"ReadyTimeout",
			`Textfresser did not become initialized and stable within ${timeoutMs}ms`,
			{ status: this.statusValue() },
		);
	}

	async settle(params = {}) {
		const timeoutMs = clampTimeout(params.timeoutMs, 30_000);
		const before = this.assertTargetReady(this.observeTextfresser());
		const startedAt = Date.now();
		await withTimeout(
			Promise.resolve().then(() => before.plugin.whenIdle()),
			timeoutMs,
			"Textfresser.whenIdle()",
		);
		const after = this.observeTextfresser();
		if (after.plugin !== before.plugin) {
			throw new DriverError(
				"TextfresserReloadedDuringRequest",
				"Textfresser instance changed while waiting for idle; discard this result and start a new scenario",
				{ after: after.status, before: before.status },
			);
		}
		return {
			elapsedMs: Date.now() - startedAt,
			generation: after.status.generation,
			instanceId: after.status.instanceId,
		};
	}

	async beginScenario(request) {
		const before = this.assertLifecycleFence(
			request,
			this.observeTextfresser(),
		);
		if (typeof before.plugin.resetSettingsForTesting !== "function") {
			throw new DriverError(
				"TextfresserProbeMissing",
				"Textfresser does not expose resetSettingsForTesting()",
			);
		}
		const scenarioId = validateScenarioId(request.params.scenarioId);
		const paths = scenarioPaths(request.sessionId, scenarioId);
		const settings = sanitizeSettings(request.params.settings);
		// Desktop E2E never reaches a provider: every scenario's dumgen answers
		// jev from its script, empty unless the scenario declares one.
		const dumgenScript =
			request.params.dumgen === undefined
				? {}
				: assertRecord(request.params.dumgen, "params.dumgen");
		const scriptedJev = validateScriptedJevAnswers(dumgenScript.jev);
		const scriptedLuna = validateScriptedLunaAnswers(dumgenScript.luna);
		const scriptedKeyCheck = validateScriptedKeyCheck(dumgenScript.keyCheck);
		const resetDictionary = assertBoolean(
			request.params.resetDictionary,
			"params.resetDictionary",
			false,
		);
		const newNotesInDictionary = assertBoolean(
			request.params.newNotesInDictionary,
			"params.newNotesInDictionary",
			false,
		);
		if (typeof before.plugin.getClassifyTestingApi !== "function") {
			throw new DriverError(
				"TextfresserProbeMissing",
				"Textfresser does not expose getClassifyTestingApi()",
			);
		}
		const dictionaryFixture = request.params.dictionaryFixture ?? [];
		if (!Array.isArray(dictionaryFixture) || dictionaryFixture.length > 200) {
			throw new DriverError(
				"InvalidFixture",
				"params.dictionaryFixture must be an array containing at most 200 notes",
			);
		}
		if (dictionaryFixture.length > 0 && !resetDictionary) {
			throw new DriverError(
				"InvalidFixture",
				"params.dictionaryFixture needs resetDictionary: true",
			);
		}
		const fixtures = request.params.fixtures ?? [];
		if (!Array.isArray(fixtures) || fixtures.length > 2_000) {
			throw new DriverError(
				"InvalidFixture",
				"params.fixtures must be an array containing at most 2000 fixtures",
			);
		}

		const observeModifications =
			request.params.observeModifications === undefined
				? null
				: resolveScopedPath(
						paths,
						assertRecord(
							request.params.observeModifications,
							"params.observeModifications",
						).path,
						"library",
						"params.observeModifications.path",
					);
		if (
			observeModifications &&
			typeof before.plugin.observeMdModificationsForTesting !== "function"
		) {
			throw new DriverError(
				"TextfresserProbeMissing",
				"Textfresser does not expose observeMdModificationsForTesting()",
			);
		}
		await this.closeModifyObserver(request.sessionId);

		await this.settle({ timeoutMs: clampTimeout(request.params.timeoutMs, 30_000) });
		const existingRoot = this.app.vault.getAbstractFileByPath(paths.scenarioRoot);
		if (existingRoot) await this.app.vault.delete(existingRoot, true);
		// The dictionary lives at the vault root, shared by every scenario: a
		// scenario that asserts what Classify creates starts from none.
		if (resetDictionary) {
			const marker = `${this.app.vault.configDir}/${E2E_VAULT_MARKER}`;
			if (!(await this.app.vault.adapter.exists(marker))) {
				throw new DriverError(
					"DictionaryResetRefused",
					`resetDictionary needs a dedicated E2E vault: add '${marker}' to it first`,
				);
			}
			// What a dictionary reset left beside it goes too: its backup
			// folders and its report notes.
			const leftovers = this.app.vault
				.getRoot()
				.children.filter(
					(child) =>
						child.path === DICTIONARY_ROOT ||
						child.path.startsWith(`${DICTIONARY_ROOT} backup `) ||
						/^Dictionary reset .*\.md$/u.test(child.path),
				);
			for (const leftover of leftovers)
				await this.app.vault.trash(leftover, false);
			if (leftovers.length > 0)
				await this.settle({
					timeoutMs: clampTimeout(request.params.timeoutMs, 30_000),
				});
		}
		// The user's vault always holds the dictionary folder, and Obsidian
		// creates a new note in the vault root when its folder is missing.
		if (newNotesInDictionary) await ensureFolder(this.app.vault, DICTIONARY_ROOT);
		// Notes the fresh dictionary starts with, such as old notes for the
		// dictionary reset to read.
		for (let index = 0; index < dictionaryFixture.length; index += 1) {
			const note = assertRecord(
				dictionaryFixture[index],
				`params.dictionaryFixture[${index}]`,
			);
			const relativePath = validateRelativePath(
				note.path,
				`params.dictionaryFixture[${index}].path`,
			);
			const path = `${DICTIONARY_ROOT}/${relativePath}`;
			if (this.app.vault.getAbstractFileByPath(path)) {
				throw new DriverError(
					"DuplicateFixture",
					`dictionary fixture path '${relativePath}' is declared more than once`,
				);
			}
			await ensureParentFolder(this.app.vault, path);
			await this.app.vault.create(
				path,
				assertString(
					note.content ?? "",
					`params.dictionaryFixture[${index}].content`,
					{ allowEmpty: true },
				),
			);
		}
		await ensureFolder(this.app.vault, paths.libraryRoot);

		const seen = new Set();
		for (let index = 0; index < fixtures.length; index += 1) {
			const fixture = assertRecord(fixtures[index], `params.fixtures[${index}]`);
			const resolved = resolveScopedPath(
				paths,
				fixture.path,
				fixture.scope,
				`params.fixtures[${index}].path`,
			);
			if (seen.has(resolved.resolved)) {
				throw new DriverError(
					"DuplicateFixture",
					`fixture path '${resolved.relativePath}' is declared more than once`,
				);
			}
			seen.add(resolved.resolved);
			await ensureParentFolder(this.app.vault, resolved.resolved);
			if (this.app.vault.getAbstractFileByPath(resolved.resolved)) {
				throw new DriverError(
					"PathCollision",
					`fixture path '${resolved.resolved}' already exists`,
				);
			}
			const encoding = fixture.encoding ?? "utf8";
			const content = fixture.content ?? "";
			if (encoding === "utf8") {
				await this.app.vault.create(
					resolved.resolved,
					assertString(content, `params.fixtures[${index}].content`, {
						allowEmpty: true,
					}),
				);
			} else if (encoding === "base64") {
				await this.app.vault.createBinary(
					resolved.resolved,
					decodeBase64(content, `params.fixtures[${index}].content`),
				);
			} else {
				throw new DriverError(
					"InvalidFixture",
					`params.fixtures[${index}].encoding must be 'utf8' or 'base64'`,
				);
			}
		}

		// Let the fixtures' own create events settle while Textfresser still
		// points elsewhere. Otherwise VAM can deliver them after the Library
		// switch below, and the new Librarian heals Leaves its startup scan
		// has already healed.
		await this.settle({ timeoutMs: clampTimeout(request.params.timeoutMs, 30_000) });

		// A scenario's settings and vault config last only for the scenario:
		// cleanupSession restores what they replaced.
		const restore = {
			settings: Object.fromEntries(
				Object.keys(settings).map((key) => [
					key,
					structuredClone(before.plugin.settings?.[key]),
				]),
			),
			vaultConfig: {},
		};
		this.restoreAfterScenario().set(request.sessionId, restore);
		if (newNotesInDictionary) {
			// The user's vault creates new notes in the dictionary
			// (`newFileLocation: folder`, `newFileFolderPath: Worter`), so a
			// click on an unresolved bare link makes a stray there.
			for (const [key, value] of [
				["newFileLocation", "folder"],
				["newFileFolderPath", DICTIONARY_ROOT],
			]) {
				restore.vaultConfig[key] = this.app.vault.getConfig(key);
				this.app.vault.setConfig(key, value);
			}
		}

		const classifyApi = before.plugin.getClassifyTestingApi();
		if (typeof classifyApi.useScriptedDumgen === "function") {
			classifyApi.useScriptedDumgen({
				jev: scriptedJev,
				keyCheck: scriptedKeyCheck,
				luna: scriptedLuna,
			});
		} else {
			classifyApi.useScriptedJev(scriptedJev);
		}
		await before.plugin.resetSettingsForTesting({
			...settings,
			libraryRoot: paths.libraryRoot,
		});
		await this.settle({ timeoutMs: clampTimeout(request.params.timeoutMs, 30_000) });
		const after = this.observeTextfresser();
		if (after.plugin !== before.plugin) {
			throw new DriverError(
				"TextfresserReloadedDuringRequest",
				"Textfresser reloaded while beginning the scenario",
				{ after: after.status, before: before.status },
			);
		}

		// Observe only after fixtures and startup healing have settled, so the
		// scenario sees the modifications its own actions cause.
		if (observeModifications) {
			this.modifyObservers().set(request.sessionId, {
				observer: await before.plugin.observeMdModificationsForTesting(
					observeModifications.resolved,
				),
				plugin: before.plugin,
			});
		}

		const active = {
			fixtureCount: fixtures.length,
			libraryRoot: paths.libraryRoot,
			scenarioId,
			scenarioRoot: paths.scenarioRoot,
			startedAt: new Date().toISOString(),
		};
		this.globalState.activeScenarios.set(request.sessionId, active);
		return active;
	}

	requireActiveScenario() {
		const scenario = this.activeScenario();
		if (!scenario) {
			throw new DriverError(
				"NoActiveScenario",
				"beginScenario must succeed before act or snapshot",
			);
		}
		return scenario;
	}

	async act(request) {
		const before = this.assertLifecycleFence(
			request,
			this.observeTextfresser(),
		);
		const scenario = this.requireActiveScenario();
		const operation = assertRecord(
			request.params.operation,
			"params.operation",
		);
		const settleAfter = assertBoolean(
			request.params.settle,
			"params.settle",
			true,
		);
		const timeoutMs = clampTimeout(request.params.timeoutMs, 30_000);
		const paths = {
			libraryRoot: scenario.libraryRoot,
			scenarioRoot: scenario.scenarioRoot,
		};
		// Opening the dictionary reset and restarting the Librarian touch no
		// path of the scenario's.
		const source =
			operation.kind === "openDictionaryReset" ||
			operation.kind === "dryRunDictionaryReset" ||
			operation.kind === "restartLibrarian"
				? null
				: resolveScopedPath(
						paths,
						operation.path,
						operation.scope,
						"params.operation.path",
					);
		const startSequence = ++this.globalState.operationSequence;
		const startedAt = new Date().toISOString();
		const affectedPaths = source ? [source.resolved] : [];

		switch (operation.kind) {
			case "create": {
				if (this.app.vault.getAbstractFileByPath(source.resolved)) {
					throw new DriverError(
						"PathAlreadyExists",
						`cannot create '${source.resolved}' because it already exists`,
					);
				}
				const entryType = operation.entryType ?? "file";
				if (entryType === "folder") {
					await ensureFolder(this.app.vault, source.resolved);
					break;
				}
				if (entryType !== "file") {
					throw new DriverError(
						"InvalidOperation",
						"create entryType must be 'file' or 'folder'",
					);
				}
				await ensureParentFolder(this.app.vault, source.resolved);
				const encoding = operation.encoding ?? "utf8";
				const content = operation.content ?? "";
				if (encoding === "utf8") {
					await this.app.vault.create(
						source.resolved,
						assertString(content, "params.operation.content", {
							allowEmpty: true,
						}),
					);
				} else if (encoding === "base64") {
					await this.app.vault.createBinary(
						source.resolved,
						decodeBase64(content, "params.operation.content"),
					);
				} else {
					throw new DriverError(
						"InvalidOperation",
						"create encoding must be 'utf8' or 'base64'",
					);
				}
				break;
			}
			case "modify": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file)) {
					throw new DriverError(
						"FileNotFound",
						`cannot modify '${source.resolved}': file not found`,
					);
				}
				const encoding = operation.encoding ?? "utf8";
				if (encoding === "utf8") {
					await this.app.vault.modify(
						file,
						assertString(operation.content, "params.operation.content", {
							allowEmpty: true,
						}),
					);
				} else if (encoding === "base64") {
					await this.app.vault.modifyBinary(
						file,
						decodeBase64(
							operation.content,
							"params.operation.content",
						),
					);
				} else {
					throw new DriverError(
						"InvalidOperation",
						"modify encoding must be 'utf8' or 'base64'",
					);
				}
				break;
			}
			case "rename": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file) {
					throw new DriverError(
						"PathNotFound",
						`cannot rename '${source.resolved}': path not found`,
					);
				}
				const destination = resolveScopedPath(
					paths,
					operation.to,
					operation.scope,
					"params.operation.to",
				);
				if (this.app.vault.getAbstractFileByPath(destination.resolved)) {
					throw new DriverError(
						"PathAlreadyExists",
						`cannot rename to '${destination.resolved}' because it already exists`,
					);
				}
				await ensureParentFolder(this.app.vault, destination.resolved);
				await this.app.fileManager.renameFile(file, destination.resolved);
				affectedPaths.push(destination.resolved);
				break;
			}
			case "delete": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file) {
					throw new DriverError(
						"PathNotFound",
						`cannot delete '${source.resolved}': path not found`,
					);
				}
				await this.app.vault.delete(file, true);
				break;
			}
			case "splitToPages": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot split '${source.resolved}': markdown file not found`,
					);
				}
				await openSourceEditor(this.app, file);
				const commandId = `${TARGET_PLUGIN_ID}:split-to-pages`;
				if (this.app.commands.executeCommandById(commandId) !== true) {
					throw new DriverError(
						"CommandUnavailable",
						`Textfresser command '${commandId}' was not available`,
					);
				}
				break;
			}
			case "splitInBlocks": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot split blocks in '${source.resolved}': markdown file not found`,
					);
				}
				const selection = assertString(
					operation.selection,
					"params.operation.selection",
				);
				const editor = await openSourceEditor(this.app, file);
				const content = editor.getValue();
				const start = content.indexOf(selection);
				if (start < 0 || content.indexOf(selection, start + 1) >= 0) {
					throw new DriverError(
						"SelectionUnavailable",
						"splitInBlocks selection must occur exactly once in the active file",
					);
				}
				editor.setSelection(
					editor.offsetToPos(start),
					editor.offsetToPos(start + selection.length),
				);
				if (editor.getSelection() !== selection) {
					throw new DriverError(
						"SelectionUnavailable",
						"active editor did not retain the requested splitInBlocks selection",
					);
				}
				const testingApi = before.plugin.getLibrarianTestingApi?.();
				if (
					typeof testingApi?.getActiveSelection !== "function" ||
					typeof testingApi?.runSplitInBlocks !== "function"
				) {
					throw new DriverError(
						"InteractionUnavailable",
						"Textfresser split-in-blocks interaction is not available",
					);
				}
				const activeSelection = await testingApi.getActiveSelection();
				if (activeSelection !== selection) {
					throw new DriverError(
						"SelectionUnavailable",
						"VAM did not observe the requested splitInBlocks selection",
						{ activeSelection, editorSelection: editor.getSelection() },
					);
				}
				let resolveModified;
				const modified = new Promise((resolve) => {
					resolveModified = resolve;
				});
				const modifyRef = this.app.vault.on("modify", (modifiedFile) => {
					if (modifiedFile.path === file.path) resolveModified();
				});
				try {
					await testingApi.runSplitInBlocks();
					if (!editor.getValue().includes(`${selection} ^0`)) {
						throw new DriverError(
							"CommandDidNotMutateEditor",
							"splitInBlocks completed without adding the first block marker",
						);
					}
					await withTimeout(
						modified,
						5_000,
						`persist editor mutation for '${file.path}'`,
					);
				} finally {
					this.app.vault.offref(modifyRef);
				}
				break;
			}
			case "classify": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot classify in '${source.resolved}': markdown file not found`,
					);
				}
				const selection = assertString(
					operation.selection,
					"params.operation.selection",
					{ maxLength: 4_096 },
				);
				const editor = await openSourceEditor(this.app, file);
				const content = editor.getValue();
				const start = content.indexOf(selection);
				if (start < 0 || content.indexOf(selection, start + 1) >= 0) {
					throw new DriverError(
						"SelectionUnavailable",
						"classify selection must occur exactly once in the active file",
					);
				}
				editor.setSelection(
					editor.offsetToPos(start),
					editor.offsetToPos(start + selection.length),
				);
				if (editor.getSelection() !== selection) {
					throw new DriverError(
						"SelectionUnavailable",
						"active editor did not retain the requested classify selection",
					);
				}
				const commandId = `${TARGET_PLUGIN_ID}:classify-selection`;
				if (this.app.commands.executeCommandById(commandId) !== true) {
					throw new DriverError(
						"CommandUnavailable",
						`Textfresser command '${commandId}' was not available`,
					);
				}
				break;
			}
			case "wrapLink": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot wrap a link in '${source.resolved}': markdown file not found`,
					);
				}
				const selection = assertString(
					operation.selection,
					"params.operation.selection",
					{ maxLength: 256 },
				);
				const editor = await openSourceEditor(this.app, file);
				const content = editor.getValue();
				const start = content.indexOf(selection);
				if (
					start < 0 ||
					content.indexOf(selection, start + 1) >= 0 ||
					selection.includes("\n")
				) {
					throw new DriverError(
						"SelectionUnavailable",
						"wrapLink selection must occur exactly once in the active file, on one line",
					);
				}
				const end = start + selection.length;
				editor.setSelection(editor.offsetToPos(start), editor.offsetToPos(end));
				// Typing `[` over a selection wraps it in `[` and `]` and keeps it
				// selected, as Obsidian's bracket auto-pair does; twice makes a link.
				for (let depth = 0; depth < 2; depth += 1) {
					const from = editor.offsetToPos(start + depth);
					const to = editor.offsetToPos(end + depth);
					editor.transaction({
						changes: [
							{ from, text: "[" },
							{ from: to, text: "]" },
						],
						selection: {
							from: { ch: from.ch + 1, line: from.line },
							to: { ch: to.ch + 1, line: to.line },
						},
					});
				}
				const wrapped = editor.getValue();
				if (
					editor.getSelection() !== selection ||
					wrapped.slice(start, end + 4) !== `[[${selection}]]`
				) {
					throw new DriverError(
						"SelectionUnavailable",
						"active editor did not wrap the requested selection in [[ ]]",
						{ editorSelection: editor.getSelection() },
					);
				}
				// Textfresser answers the completed link asynchronously; a link it
				// leaves alone keeps the wrapped text.
				const deadline = Date.now() + 2_000;
				while (editor.getValue() === wrapped && Date.now() < deadline)
					await sleep(20);
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file !== file) {
					throw new DriverError(
						"EditorUnavailable",
						`source editor for '${file.path}' is no longer active`,
					);
				}
				await view.save();
				break;
			}
			case "followLink": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot follow a link in '${source.resolved}': markdown file not found`,
					);
				}
				const linkpath = assertString(
					operation.linkpath,
					"params.operation.linkpath",
					{ maxLength: 1_024 },
				);
				const editor = await openSourceEditor(this.app, file);
				// Only a link the note holds is followed, as a click on it is.
				const content = editor.getValue();
				if (
					!content.includes(`[[${linkpath}]]`) &&
					!content.includes(`[[${linkpath}|`)
				) {
					throw new DriverError(
						"LinkUnavailable",
						`'${source.resolved}' holds no link to '${linkpath}'`,
					);
				}
				await this.app.workspace.openLinkText(linkpath, file.path, false);
				break;
			}
			case "pageNavigation": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot navigate from '${source.resolved}': markdown file not found`,
					);
				}
				if (operation.direction !== "next" && operation.direction !== "prev") {
					throw new DriverError(
						"InvalidOperation",
						"pageNavigation direction must be next or prev",
					);
				}
				await openSourceEditor(this.app, file);
				const testingApi = before.plugin.getLibrarianTestingApi?.();
				if (typeof testingApi?.runPageNavigation !== "function") {
					throw new DriverError(
						"InteractionUnavailable",
						"Textfresser page navigation is not available",
					);
				}
				await testingApi.runPageNavigation(operation.direction);
				break;
			}
			case "toggleCodexEntry": {
				const file = this.app.vault.getAbstractFileByPath(source.resolved);
				if (!file || !isFile(file) || file.extension?.toLowerCase() !== "md") {
					throw new DriverError(
						"FileNotFound",
						`cannot toggle '${source.resolved}': Codex file not found`,
					);
				}
				if (typeof operation.checked !== "boolean") {
					throw new DriverError(
						"InvalidOperation",
						"toggleCodexEntry checked must be a boolean",
					);
				}
				const lineContent = assertString(
					operation.lineContent,
					"params.operation.lineContent",
				);
				const testingApi = before.plugin.getLibrarianTestingApi?.();
				if (typeof testingApi?.handleCodexCheckboxClick !== "function") {
					throw new DriverError(
						"InteractionUnavailable",
						"Textfresser checkbox interaction is not available",
					);
				}
				await testingApi.handleCodexCheckboxClick({
					checked: operation.checked,
					kind: "CheckboxClicked",
					lineContent,
					sourcePath: source.resolved,
				});
				break;
			}
			case "openDictionaryReset": {
				const testingApi = before.plugin.getDictionaryResetTestingApi?.();
				if (typeof testingApi?.lastOpening !== "function") {
					throw new DriverError(
						"InteractionUnavailable",
						"Textfresser dictionary reset is not available",
					);
				}
				const commandId = `${TARGET_PLUGIN_ID}:reset-dictionary-from-old-notes`;
				if (this.app.commands.executeCommandById(commandId) !== true) {
					throw new DriverError(
						"CommandUnavailable",
						`Textfresser command '${commandId}' was not available`,
					);
				}
				const opening = testingApi.lastOpening();
				if (!opening) {
					throw new DriverError(
						"InteractionUnavailable",
						"the dictionary reset command did not start opening its modal",
					);
				}
				dictionaryResetOpenings.set(scenario, await opening);
				// The modal is closed again, clicking nothing in it, so it does
				// not cover the test window.
				testingApi.closeModal();
				break;
			}
			case "dryRunDictionaryReset": {
				const execute = assertBoolean(
					operation.execute,
					"params.operation.execute",
					false,
				);
				const testingApi = before.plugin.getDictionaryResetTestingApi?.();
				if (
					typeof testingApi?.clickButton !== "function" ||
					typeof testingApi?.lastDryRun !== "function"
				) {
					throw new DriverError(
						"InteractionUnavailable",
						"Textfresser dictionary reset is not available",
					);
				}
				const commandId = `${TARGET_PLUGIN_ID}:reset-dictionary-from-old-notes`;
				if (this.app.commands.executeCommandById(commandId) !== true) {
					throw new DriverError(
						"CommandUnavailable",
						`Textfresser command '${commandId}' was not available`,
					);
				}
				const click = (label) => {
					if (!testingApi.clickButton(label)) {
						testingApi.closeModal();
						throw new DriverError(
							"InteractionUnavailable",
							`the dictionary reset showed no enabled '${label}' button`,
						);
					}
				};
				try {
					const opening = await testingApi.lastOpening();
					if (opening?.kind !== "Opened") {
						throw new DriverError(
							"InteractionUnavailable",
							`the dictionary reset modal did not open: ${opening?.notice ?? "no opening"}`,
						);
					}
					dictionaryResetOpenings.set(scenario, opening);
					const dryRunBefore = testingApi.lastDryRun();
					click("Dry run");
					const shown = testingApi.lastDryRun();
					if (!shown || shown === dryRunBefore) {
						throw new DriverError(
							"InteractionUnavailable",
							"the dictionary reset's Dry run did not start",
						);
					}
					const dryRun = await shown;
					const run = { dryRun, execute: null };
					dictionaryResetRuns.set(scenario, run);
					if (execute) {
						if (dryRun.kind !== "Report") {
							throw new DriverError(
								"InteractionUnavailable",
								`the dictionary reset's dry run failed: ${dryRun.notice}`,
							);
						}
						// Execute… on the report, then Execute in the confirmation.
						const executeBefore = testingApi.lastExecute();
						click("Execute…");
						click("Execute");
						const executed = testingApi.lastExecute();
						if (!executed || executed === executeBefore) {
							throw new DriverError(
								"InteractionUnavailable",
								"the dictionary reset's Execute did not start",
							);
						}
						dictionaryResetRuns.set(scenario, {
							...run,
							execute: await executed,
						});
					}
				} finally {
					// No modal stays to cover the test window.
					testingApi.closeModal();
				}
				break;
			}
			case "restartLibrarian": {
				// The command counts its restart as pending work, so the
				// settle below waits for it.
				const commandId = `${TARGET_PLUGIN_ID}:restart-librarian`;
				if (this.app.commands.executeCommandById(commandId) !== true) {
					throw new DriverError(
						"CommandUnavailable",
						`Textfresser command '${commandId}' was not available`,
					);
				}
				break;
			}
			default:
				throw new DriverError(
					"InvalidOperation",
					"params.operation.kind must be create, modify, rename, delete, splitToPages, splitInBlocks, classify, wrapLink, followLink, pageNavigation, toggleCodexEntry, openDictionaryReset, dryRunDictionaryReset, or restartLibrarian",
				);
		}

		let settled = null;
		if (settleAfter) settled = await this.settle({ timeoutMs });
		// Classify writes its block IDs and links into the Scroll's open
		// editor, and the store fills a clicked note while it is open; the
		// act returns once that is on disk too, and once Textfresser has
		// answered the save.
		if (
			settleAfter &&
			(operation.kind === "classify" || operation.kind === "followLink")
		) {
			await persistActiveEditor(this.app);
			settled = await this.settle({ timeoutMs });
		}
		const after = this.observeTextfresser();
		if (after.plugin !== before.plugin) {
			throw new DriverError(
				"TextfresserReloadedDuringRequest",
				"Textfresser reloaded while applying the operation",
				{ after: after.status, before: before.status },
			);
		}
		const settledSequence = ++this.globalState.operationSequence;
		return {
			affectedPaths,
			completedAt: new Date().toISOString(),
			generation: after.status.generation,
			instanceId: after.status.instanceId,
			kind: operation.kind,
			operationId: request.requestId,
			settled,
			settledSequence,
			startedAt,
			startSequence,
		};
	}

	restoreAfterScenario() {
		if (!(this.globalState.restoreAfterScenario instanceof Map)) {
			this.globalState.restoreAfterScenario = new Map();
		}
		return this.globalState.restoreAfterScenario;
	}

	modifyObservers() {
		if (!(this.globalState.modifyObservers instanceof Map)) {
			this.globalState.modifyObservers = new Map();
		}
		return this.globalState.modifyObservers;
	}

	async closeModifyObserver(sessionId) {
		const observers = this.modifyObservers();
		const entry = observers.get(sessionId);
		if (!entry) return;
		observers.delete(sessionId);
		try {
			await entry.observer.close();
		} catch (error) {
			// A reloaded plugin already disposed the observer with its VAM
			// runtime, so closing it again can fail; that leaves nothing open.
			if (this.observeTextfresser().plugin === entry.plugin) throw error;
		}
	}

	async modifications(params) {
		const scenario = this.requireActiveScenario();
		const entry = this.modifyObservers().get(this.config.sessionId);
		if (!entry) {
			throw new DriverError(
				"ModificationsNotObserved",
				"beginScenario must request observeModifications before modifications can be read",
			);
		}
		await this.settle({ timeoutMs: clampTimeout(params.timeoutMs, 30_000) });
		if (this.observeTextfresser().plugin !== entry.plugin) {
			throw new DriverError(
				"TextfresserReloadedDuringRequest",
				"Textfresser reloaded after modifications began to be observed",
			);
		}
		return {
			modifications: entry.observer.read().map(({ mtime, path, size }) => ({
				mtime,
				path: relativeTo(scenario.libraryRoot, path),
				size,
			})),
		};
	}

	async snapshot(params) {
		const scenario = this.requireActiveScenario();
		const scope = validateScope(params.scope, "params.scope");
		const includeBinaryContent = assertBoolean(
			params.includeBinaryContent,
			"params.includeBinaryContent",
			false,
		);
		const root =
			scope === "library" ? scenario.libraryRoot : scenario.scenarioRoot;
		const rootEntry = this.app.vault.getAbstractFileByPath(root);
		if (!rootEntry || !isFolder(rootEntry)) {
			throw new DriverError(
				"SnapshotRootMissing",
				`snapshot root '${root}' does not exist`,
			);
		}

		const directories = [];
		const fileEntries = [];
		const visit = (folder) => {
			for (const child of folder.children ?? []) {
				if (isFolder(child)) {
					directories.push(relativeTo(root, child.path));
					visit(child);
				} else if (isFile(child)) {
					fileEntries.push(child);
				}
			}
		};
		visit(rootEntry);
		directories.sort();
		fileEntries.sort((left, right) =>
			left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
		);

		const files = [];
		const markdown = {};
		for (const file of fileEntries) {
			const path = relativeTo(root, file.path);
			if (file.extension?.toLowerCase() === "md") {
				const content = await this.app.vault.read(file);
				markdown[path] = content;
				files.push({
					kind: "markdown",
					path,
					sha256: sha256(content),
					size: file.stat?.size ?? Buffer.byteLength(content),
				});
			} else {
				const content = await this.app.vault.readBinary(file);
				const bytes = Buffer.from(content);
				const entry = {
					kind: "binary",
					path,
					sha256: sha256(bytes),
					size: file.stat?.size ?? bytes.byteLength,
				};
				if (includeBinaryContent) entry.contentBase64 = encodeArrayBuffer(content);
				files.push(entry);
			}
		}

		return {
			capturedAt: new Date().toISOString(),
			directories,
			files,
			markdown,
			root,
			scenarioId: scenario.scenarioId,
			scope,
		};
	}

	/**
	 * The dictionary's notes under the vault-root `Worter/` folder, by vault
	 * path, read-only. Classify writes there, outside the scenario's library.
	 */
	async dictionary() {
		this.requireActiveScenario();
		await this.settle({ timeoutMs: 30_000 });
		const markdown = {};
		const root = this.app.vault.getAbstractFileByPath(DICTIONARY_ROOT);
		const visit = async (folder) => {
			for (const child of folder.children ?? []) {
				if (isFolder(child)) await visit(child);
				else if (isFile(child) && child.extension?.toLowerCase() === "md")
					markdown[child.path] = await this.app.vault.read(child);
			}
		};
		if (root && isFolder(root)) await visit(root);
		return {
			markdown: Object.fromEntries(
				Object.entries(markdown).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
			),
		};
	}

	diagnostics() {
		const status = this.statusValue();
		const plugin = this.observeTextfresser().plugin;
		const librarian = plugin?.getLibrarianTestingApi?.().librarian ?? null;
		const sessionPrefix = this.config ? `${this.config.sessionId}:` : "";
		let sessionCacheEntries = 0;
		let pendingCacheEntries = 0;
		for (const [key, entry] of this.globalState.requestCache) {
			if (!key.startsWith(sessionPrefix)) continue;
			sessionCacheEntries += 1;
			if (entry.pending) pendingCacheEntries += 1;
		}
		return {
			...status,
			capturedAt: new Date().toISOString(),
			e2eMode: globalThis.__E2E_MODE === true,
			obsidianApiVersion: apiVersion,
			operationSequence: this.globalState.operationSequence,
			recentReconciliations:
				librarian?.getRecentReconciliationOutcomes?.(10) ?? [],
			requestCache: {
				limit: CACHE_LIMIT,
				pendingEntries: pendingCacheEntries,
				sessionEntries: sessionCacheEntries,
				totalEntries: this.globalState.requestCache.size,
			},
			sessionMarkerOwned:
				globalThis[SESSION_MARKER_KEY] === this.sessionMarker,
			vaultName: this.app.vault.getName(),
		};
	}

	async cleanupSession(request) {
		const before = this.assertLifecycleFence(
			request,
			this.observeTextfresser(),
		);
		const timeoutMs = clampTimeout(request.params.timeoutMs, 30_000);
		await this.closeModifyObserver(this.config.sessionId);
		await this.settle({ timeoutMs });
		before.plugin.getClassifyTestingApi?.().useScriptedJev(null);

		// Stop observing the session before deleting it. The stable driver-owned
		// quarantine is outside E2E/, so cleanup cannot race Librarian healing or
		// leave one quarantine subtree behind for every run.
		const quarantineRoot = "_TextfresserE2EQuarantine/Library";
		await ensureFolder(this.app.vault, quarantineRoot);
		const restore = this.restoreAfterScenario().get(this.config.sessionId);
		this.restoreAfterScenario().delete(this.config.sessionId);
		for (const [key, value] of Object.entries(restore?.vaultConfig ?? {}))
			this.app.vault.setConfig(key, value);
		await before.plugin.resetSettingsForTesting({
			...(restore?.settings ?? {}),
			libraryRoot: quarantineRoot,
		});
		await this.settle({ timeoutMs });

		const sessionRoot = `E2E/${this.config.sessionId}`;
		const existing = this.app.vault.getAbstractFileByPath(sessionRoot);
		const allSessions = this.app.vault.getAbstractFileByPath("E2E");
		if (allSessions) await this.app.vault.delete(allSessions, true);
		await this.settle({ timeoutMs });
		if (this.app.vault.getAbstractFileByPath(sessionRoot)) {
			throw new DriverError(
				"SessionCleanupFailed",
				`session root '${sessionRoot}' reappeared after Textfresser settled`,
				{ quarantineRoot, sessionRoot },
			);
		}
		const after = this.observeTextfresser();
		if (after.plugin !== before.plugin) {
			throw new DriverError(
				"TextfresserReloadedDuringRequest",
				"Textfresser reloaded while cleaning the session",
				{ after: after.status, before: before.status },
			);
		}
		this.globalState.activeScenarios.delete(this.config.sessionId);
		return {
			cleanedAt: new Date().toISOString(),
			quarantineRoot,
			removed: existing !== null,
			sessionRoot,
		};
	}
}

module.exports = TextfresserE2EDriver;
