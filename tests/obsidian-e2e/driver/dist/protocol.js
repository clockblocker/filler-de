"use strict";

const PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = 1024 * 1024;
const REQUEST_METHODS = new Set([
	"status",
	"ready",
	"beginScenario",
	"act",
	"settle",
	"snapshot",
	"diagnostics",
	"cleanupSession",
]);
const MUTATING_METHODS = new Set([
	"beginScenario",
	"act",
	"cleanupSession",
]);
const SCOPES = new Set(["library", "scenario"]);

class ProtocolError extends Error {
	constructor(kind, message, details) {
		super(message);
		this.name = "ProtocolError";
		this.kind = kind;
		this.details = details;
	}
}

function isRecord(value) {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value)
	);
}

function assertRecord(value, label) {
	if (!isRecord(value)) {
		throw new ProtocolError(
			"InvalidRequest",
			`${label} must be a JSON object`,
		);
	}
	return value;
}

function assertString(value, label, options = {}) {
	if (typeof value !== "string") {
		throw new ProtocolError("InvalidRequest", `${label} must be a string`);
	}
	const minimum = options.allowEmpty ? 0 : 1;
	const maximum = options.maxLength ?? 256;
	if (value.length < minimum || value.length > maximum) {
		throw new ProtocolError(
			"InvalidRequest",
			`${label} must contain between ${minimum} and ${maximum} characters`,
		);
	}
	return value;
}

function validateIdentifier(value, label, maximum = 128) {
	const identifier = assertString(value, label, { maxLength: maximum });
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(identifier)) {
		throw new ProtocolError(
			"InvalidRequest",
			`${label} may contain only ASCII letters, digits, '.', '_', ':', and '-' and must start with a letter or digit`,
		);
	}
	if (identifier === "." || identifier === "..") {
		throw new ProtocolError("InvalidRequest", `${label} cannot be '${identifier}'`);
	}
	return identifier;
}

function validatePathSegmentIdentifier(value, label) {
	const identifier = validateIdentifier(value, label, 96);
	if (identifier.includes(":")) {
		throw new ProtocolError(
			"InvalidRequest",
			`${label} cannot contain ':' because it is used as a vault path segment`,
		);
	}
	return identifier;
}

function decodeBase64UrlJson(encoded) {
	const request = assertString(encoded, "request", {
		maxLength: Math.ceil((MAX_REQUEST_BYTES * 4) / 3) + 8,
	});
	if (!/^[A-Za-z0-9_-]+$/.test(request)) {
		throw new ProtocolError(
			"InvalidEncoding",
			"request must be unpadded base64url JSON (letters, digits, '_' and '-' only)",
		);
	}

	let decoded;
	try {
		decoded = Buffer.from(request, "base64url");
	} catch (error) {
		throw new ProtocolError(
			"InvalidEncoding",
			`request is not valid base64url: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (decoded.byteLength > MAX_REQUEST_BYTES) {
		throw new ProtocolError(
			"RequestTooLarge",
			`decoded request exceeds the ${MAX_REQUEST_BYTES} byte limit`,
		);
	}

	let value;
	try {
		value = JSON.parse(decoded.toString("utf8"));
	} catch (error) {
		throw new ProtocolError(
			"InvalidJson",
			`request did not decode to valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	return value;
}

function validateRequest(value) {
	const request = assertRecord(value, "request");
	if (request.protocol !== PROTOCOL_VERSION) {
		throw new ProtocolError(
			"UnsupportedProtocol",
			`expected protocol ${PROTOCOL_VERSION}, received ${String(request.protocol)}`,
		);
	}

	const sessionId = validatePathSegmentIdentifier(
		request.sessionId,
		"request.sessionId",
	);
	const requestId = validateIdentifier(request.requestId, "request.requestId");
	const method = assertString(request.method, "request.method", {
		maxLength: 64,
	});
	if (!REQUEST_METHODS.has(method)) {
		throw new ProtocolError(
			"UnknownMethod",
			`unknown method '${method}'; expected one of ${Array.from(REQUEST_METHODS).join(", ")}`,
		);
	}

	const params = request.params === undefined ? {} : request.params;
	assertRecord(params, "request.params");

	let expectedInstanceId;
	let expectedGeneration;
	if (request.expectedInstanceId !== undefined) {
		expectedInstanceId = assertString(
			request.expectedInstanceId,
			"request.expectedInstanceId",
			{ maxLength: 128 },
		);
	}
	if (request.expectedGeneration !== undefined) {
		if (
			!Number.isSafeInteger(request.expectedGeneration) ||
			request.expectedGeneration < 1
		) {
			throw new ProtocolError(
				"InvalidRequest",
				"request.expectedGeneration must be a positive safe integer",
			);
		}
		expectedGeneration = request.expectedGeneration;
	}

	if (MUTATING_METHODS.has(method)) {
		if (expectedInstanceId === undefined || expectedGeneration === undefined) {
			throw new ProtocolError(
				"LifecycleFenceRequired",
				`${method} requires expectedInstanceId and expectedGeneration from ready/status; refusing an unfenced mutation`,
			);
		}
	}

	return {
		protocol: PROTOCOL_VERSION,
		sessionId,
		requestId,
		expectedInstanceId,
		expectedGeneration,
		method,
		params,
	};
}

function parseEncodedRequest(encoded) {
	return validateRequest(decodeBase64UrlJson(encoded));
}

function validateDriverConfig(value) {
	const config = assertRecord(value, "driver data.json");
	if (
		config.protocol !== undefined &&
		config.protocol !== PROTOCOL_VERSION
	) {
		throw new ProtocolError(
			"DriverConfigurationError",
			`driver data.json protocol must be ${PROTOCOL_VERSION} when present`,
		);
	}
	return {
		protocol: PROTOCOL_VERSION,
		sessionId: validatePathSegmentIdentifier(
			config.sessionId,
			"driver data.json sessionId",
		),
	};
}

function validateScenarioId(value) {
	return validatePathSegmentIdentifier(value, "params.scenarioId");
}

function validateScope(value, label = "scope") {
	const scope = value === undefined ? "library" : value;
	if (typeof scope !== "string" || !SCOPES.has(scope)) {
		throw new ProtocolError(
			"InvalidScope",
			`${label} must be 'library' or 'scenario'`,
		);
	}
	return scope;
}

function validateRelativePath(value, label = "path", options = {}) {
	const path = assertString(value, label, {
		allowEmpty: options.allowEmpty === true,
		maxLength: 1024,
	});
	if (path === "" && options.allowEmpty === true) return "";
	if (path.startsWith("/") || path.endsWith("/") || path.includes("\\")) {
		throw new ProtocolError(
			"PathOutsideScenario",
			`${label} must be a slash-separated path relative to its declared scope`,
		);
	}
	if (/^[A-Za-z]:/.test(path)) {
		throw new ProtocolError(
			"PathOutsideScenario",
			`${label} must not be an absolute Windows path`,
		);
	}
	if (/\p{Cc}/u.test(path)) {
		throw new ProtocolError(
			"InvalidPath",
			`${label} must not contain control characters`,
		);
	}

	const segments = path.split("/");
	for (const segment of segments) {
		if (segment === "" || segment === "." || segment === "..") {
			throw new ProtocolError(
				"PathOutsideScenario",
				`${label} contains the forbidden path segment '${segment}'`,
			);
		}
	}
	return segments.join("/");
}

function scenarioPaths(sessionIdValue, scenarioIdValue) {
	const sessionId = validatePathSegmentIdentifier(sessionIdValue, "sessionId");
	const scenarioId = validatePathSegmentIdentifier(
		scenarioIdValue,
		"scenarioId",
	);
	const scenarioRoot = `E2E/${sessionId}/${scenarioId}`;
	return {
		scenarioRoot,
		libraryRoot: `${scenarioRoot}/Library`,
	};
}

function resolveScopedPath(paths, rawPath, rawScope, label = "path") {
	const scope = validateScope(rawScope, `${label} scope`);
	const relativePath = validateRelativePath(rawPath, label);
	const base = scope === "library" ? paths.libraryRoot : paths.scenarioRoot;
	const resolved = `${base}/${relativePath}`;
	if (resolved !== base && !resolved.startsWith(`${base}/`)) {
		throw new ProtocolError(
			"PathOutsideScenario",
			`${label} resolved outside ${base}`,
		);
	}
	return { relativePath, resolved, scope };
}

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalize(value[key])]),
		);
	}
	return value;
}

function requestFingerprint(request) {
	return JSON.stringify(canonicalize(request));
}

module.exports = {
	MAX_REQUEST_BYTES,
	MUTATING_METHODS,
	PROTOCOL_VERSION,
	ProtocolError,
	REQUEST_METHODS,
	decodeBase64UrlJson,
	isRecord,
	parseEncodedRequest,
	requestFingerprint,
	resolveScopedPath,
	scenarioPaths,
	validateDriverConfig,
	validateIdentifier,
	validatePathSegmentIdentifier,
	validateRelativePath,
	validateRequest,
	validateScenarioId,
	validateScope,
};
