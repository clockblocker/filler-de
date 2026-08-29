import { describe, expect, it } from "bun:test";
import {
	LEGACY_EDGE_REPORT_BASELINE,
	LEGACY_P0_ORCHESTRATION_CORPUS,
	PROVIDER_ACCEPTANCE_CASES,
	selectProviderCases,
} from "./corpus";
import { parseCliOptions, requireOptIn } from "./run";

describe("Textfresser provider acceptance preflight", () => {
	it("requires explicit authorization before reading a provider key", () => {
		expect(() =>
			requireOptIn({ GEMINI_API_KEY: "not-a-real-key" }),
		).toThrow("TEXTFRESSER_PROVIDER_ACCEPTANCE=1");
		expect(() =>
			requireOptIn({ TEXTFRESSER_PROVIDER_ACCEPTANCE: "1" }),
		).toThrow("Missing GEMINI_API_KEY");
		expect(
			requireOptIn({
				GEMINI_API_KEY: "not-a-real-key",
				TEXTFRESSER_PROVIDER_ACCEPTANCE: "1",
			}),
		).toBe("not-a-real-key");
	});

	it("requires an explicit suite budget", () => {
		expect(() => parseCliOptions([], {})).toThrow(
			"Choose an explicit request budget",
		);
		expect(parseCliOptions(["--suite=smoke"], {}).suite).toBe("smoke");
		expect(parseCliOptions(["--suite=edge"], {}).suite).toBe("edge");
	});

	it("preserves every legacy live-runner case", () => {
		expect(
			PROVIDER_ACCEPTANCE_CASES.filter((testCase) =>
				testCase.id.startsWith("SMOKE-"),
			),
		).toHaveLength(9);
		expect(
			PROVIDER_ACCEPTANCE_CASES.filter(
				(testCase) => testCase.suite === "edge",
			),
		).toHaveLength(25);
		expect(new Set(PROVIDER_ACCEPTANCE_CASES.map(({ id }) => id)).size).toBe(
			PROVIDER_ACCEPTANCE_CASES.length,
		);
	});

	it("includes ordered sense prerequisites for a focused case", () => {
		expect(
			selectProviderCases({ caseId: "H1-C", suite: "edge" }).map(
				(testCase) => testCase.id,
			),
		).toEqual(["H1-A", "H1-B", "H1-C"]);
	});

	it("retains the helper scenarios and historical report observations", () => {
		expect(LEGACY_P0_ORCHESTRATION_CORPUS.assertions.rerunIsIdempotent).toEqual(
			["Mann", "Katze", "fängt", "auf", "klar"],
		);
		expect(
			LEGACY_P0_ORCHESTRATION_CORPUS.assertions.latestPendingGenerate,
		).toEqual(["klar", "deutlich"]);
		expect(LEGACY_EDGE_REPORT_BASELINE.entryNotResolvedCaseIds).toHaveLength(
			10,
		);
	});
});
