import { describe, expect, it } from "bun:test";
import { inScope, isUnder } from "../src/vault";

const NFC = "Mütter";
const NFD = "Mütter";

describe("dictionary scope", () => {
	it("holds paths below Worter/ by whole segments, case-sensitively", () => {
		expect(inScope("Worter/de/a.md")).toBe(true);
		expect(inScope("Worter")).toBe(false);
		expect(inScope("Worterbuch/a.md")).toBe(false);
		expect(inScope("worter/a.md")).toBe(false);
	});

	it("puts a folder's own path and its descendants under it, and all under the root", () => {
		expect(isUnder("Worter/de", "Worter/de")).toBe(true);
		expect(isUnder("Worter/de/a.md", "Worter/de")).toBe(true);
		expect(isUnder("Worter/den/a.md", "Worter/de")).toBe(false);
		expect(isUnder("Worter/a.md", "")).toBe(true);
	});

	it("matches paths whatever their Unicode composition", () => {
		expect(isUnder(`Worter/${NFC}/a.md`, `Worter/${NFD}`)).toBe(true);
	});
});
