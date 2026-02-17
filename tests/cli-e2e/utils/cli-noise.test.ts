import { describe, expect, it } from "bun:test";
import { stripCliNoise } from "./cli";

describe("stripCliNoise", () => {
	it("removes Obsidian package loading noise from stdout-like content", () => {
		const output = [
			"2026-02-16 12:32:42 Loading updated app package /path/to/obsidian.asar",
			"Das alte [[Schloss]] thront über der Stadt. ^h1a",
		].join("\n");

		expect(stripCliNoise(output)).toBe(
			"Das alte [[Schloss]] thront über der Stadt. ^h1a",
		);
	});

	it("removes 'Checking for updates' noise", () => {
		const output = [
			"Checking for updates...",
			"=> some result",
		].join("\n");

		expect(stripCliNoise(output)).toBe("=> some result");
	});

	it("removes multiple noise lines mixed with content", () => {
		const output = [
			"Loading updated app package /path/to/obsidian.asar",
			"Checking for updates",
			"actual content line",
		].join("\n");

		expect(stripCliNoise(output)).toBe("actual content line");
	});

	it("keeps normal output unchanged except trimming", () => {
		expect(stripCliNoise("  hello world  ")).toBe("hello world");
	});
});
