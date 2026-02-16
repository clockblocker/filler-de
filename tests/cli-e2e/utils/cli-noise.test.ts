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

	it("keeps normal output unchanged except trimming", () => {
		expect(stripCliNoise("  hello world  ")).toBe("hello world");
	});
});
