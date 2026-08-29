import { describe, expect, it } from "bun:test";
import { isOfficialCliTarget, parseCliJson, stripCliNoise } from "./cli";
import { HarnessError } from "./errors";

describe("official Obsidian CLI transport", () => {
	it("accepts only the official executable target", () => {
		expect(
			isOfficialCliTarget(
				"/Applications/Obsidian.app/Contents/MacOS/obsidian-cli",
			),
		).toBe(true);
		expect(
			isOfficialCliTarget("/Applications/Obsidian.app/Contents/MacOS/Obsidian"),
		).toBe(false);
	});

	it("parses JSON values after CLI noise and the eval-style prefix", () => {
		const value = parseCliJson<{ ok: boolean }>(
			'Checking for updates\n=> {"ok":true}',
			"probe",
		);
		expect(value).toEqual({ ok: true });
	});

	it("turns zero-exit error text into a typed failure", () => {
		expect(() => parseCliJson("Error: renderer exploded", "probe")).toThrow(
			HarnessError,
		);
	});

	it("strips only known process noise", () => {
		expect(stripCliNoise("Loading updated app package\nreal output")).toBe(
			"real output",
		);
	});
});
