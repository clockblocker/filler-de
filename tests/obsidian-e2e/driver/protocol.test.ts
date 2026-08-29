import { describe, expect, it } from "bun:test";

const {
	PROTOCOL_VERSION,
	ProtocolError,
	parseEncodedRequest,
	requestFingerprint,
	resolveScopedPath,
	scenarioPaths,
	validateDriverConfig,
	validateRelativePath,
} = require("./dist/protocol.js") as typeof import("./dist/protocol.js");

function encode(value: unknown): string {
	return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function request(overrides: Record<string, unknown> = {}) {
	return {
		protocol: PROTOCOL_VERSION,
		sessionId: "session-123",
		requestId: "request-1",
		method: "status",
		params: {},
		...overrides,
	};
}

describe("driver protocol request parsing", () => {
	it("decodes and validates a status request", () => {
		expect(parseEncodedRequest(encode(request()))).toEqual({
			expectedGeneration: undefined,
			expectedInstanceId: undefined,
			method: "status",
			params: {},
			protocol: PROTOCOL_VERSION,
			requestId: "request-1",
			sessionId: "session-123",
		});
	});

	it("requires lifecycle fencing for every mutation", () => {
		for (const method of ["beginScenario", "act", "cleanupSession"]) {
			expect(() =>
				parseEncodedRequest(encode(request({ method }))),
			).toThrow("requires expectedInstanceId and expectedGeneration");
		}

		expect(
			parseEncodedRequest(
				encode(
					request({
						expectedGeneration: 3,
						expectedInstanceId: "textfresser-abc",
						method: "act",
					}),
				),
			).expectedGeneration,
		).toBe(3);
	});

	it("rejects malformed transport and protocol versions", () => {
		expect(() => parseEncodedRequest("not+base64")).toThrow(
			"unpadded base64url JSON",
		);
		expect(() =>
			parseEncodedRequest(encode(request({ protocol: 2 }))),
		).toThrow("expected protocol 1");
		expect(() =>
			parseEncodedRequest(encode(request({ method: "eval" }))),
		).toThrow("unknown method 'eval'");
	});

	it("rejects identifiers that could become path traversal", () => {
		for (const sessionId of ["../other", "/absolute", "two/parts", "C:run"]) {
			expect(() =>
				parseEncodedRequest(encode(request({ sessionId }))),
			).toThrow(ProtocolError);
		}
	});

	it("uses a canonical fingerprint for idempotency conflicts", () => {
		const left = request({ params: { b: 2, a: { d: 4, c: 3 } } });
		const right = request({ params: { a: { c: 3, d: 4 }, b: 2 } });
		expect(requestFingerprint(left)).toBe(requestFingerprint(right));
	});
});

describe("driver protocol path confinement", () => {
	it("builds an isolated scenario and library root", () => {
		expect(scenarioPaths("session-123", "rename-folders")).toEqual({
			scenarioRoot: "E2E/session-123/rename-folders",
			libraryRoot: "E2E/session-123/rename-folders/Library",
		});
	});

	it("defaults paths to the scenario library", () => {
		const paths = scenarioPaths("session-123", "rename-folders");
		expect(resolveScopedPath(paths, "Recipe/Pie.md")).toEqual({
			relativePath: "Recipe/Pie.md",
			resolved:
				"E2E/session-123/rename-folders/Library/Recipe/Pie.md",
			scope: "library",
		});
		expect(
			resolveScopedPath(paths, "Outside/source.md", "scenario").resolved,
		).toBe("E2E/session-123/rename-folders/Outside/source.md");
	});

	it("accepts human-readable Unicode paths", () => {
		expect(validateRelativePath("Wörter/Über den Fluß.md")).toBe(
			"Wörter/Über den Fluß.md",
		);
	});

	it("rejects traversal, absolute paths, separators, and empty segments", () => {
		for (const path of [
			"../escape.md",
			"nested/../../escape.md",
			"/absolute.md",
			"C:\\absolute.md",
			"double//segment.md",
			"trailing/",
		]) {
			expect(() => validateRelativePath(path)).toThrow(ProtocolError);
		}
	});
});

describe("driver data.json", () => {
	it("accepts the minimal runner-written configuration", () => {
		expect(validateDriverConfig({ sessionId: "run-123" })).toEqual({
			protocol: PROTOCOL_VERSION,
			sessionId: "run-123",
		});
	});

	it("rejects a missing session and a different protocol", () => {
		expect(() => validateDriverConfig({})).toThrow(
			"driver data.json sessionId must be a string",
		);
		expect(() =>
			validateDriverConfig({ protocol: 2, sessionId: "run-123" }),
		).toThrow("protocol must be 1");
	});
});
