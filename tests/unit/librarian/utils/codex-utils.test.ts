import { describe, expect, it } from "vitest";
import {
	buildCodexBasename,
	getCodexSectionName,
	isCodexBasename,
} from "../../../../src/commanders/librarian/utils/codex-utils";

describe("codex-utils", () => {
	describe("isCodexBasename", () => {
		it("returns true for codex basename", () => {
			expect(isCodexBasename("__Library")).toBe(true);
			expect(isCodexBasename("__A")).toBe(true);
			expect(isCodexBasename("__Section")).toBe(true);
		});

		it("returns false for non-codex basename", () => {
			expect(isCodexBasename("Note")).toBe(false);
			expect(isCodexBasename("_Note")).toBe(false); // single underscore
			expect(isCodexBasename("My__File")).toBe(false); // __ not at start
		});
	});

	describe("getCodexSectionName", () => {
		it("strips __ prefix", () => {
			expect(getCodexSectionName("__Library")).toBe("Library");
			expect(getCodexSectionName("__A")).toBe("A");
		});

		it("returns unchanged for non-codex", () => {
			expect(getCodexSectionName("Note")).toBe("Note");
		});
	});

	describe("buildCodexBasename", () => {
		it("adds __ prefix", () => {
			expect(buildCodexBasename("Library")).toBe("__Library");
			expect(buildCodexBasename("A")).toBe("__A");
		});
	});
});
