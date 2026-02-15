/**
 * Unit tests for go-back link helper (strip, add, isMatch).
 * Covers duplicated go-back link case: strip must remove all leading links.
 */
import { describe, expect, it } from "bun:test";
import { goBackLinkHelper } from "../../src/stateless-helpers/go-back-link/go-back-link";

describe("goBackLinkHelper.strip", () => {
	const oneLink = "[[__;;Das Sagt Mann So;;Text|← Das Sagt Mann So]] \n";
	const twoLinks =
		"[[__;;Das Sagt Mann So;;Text|← Das Sagt Mann So]] \n[[__;;Das Sagt Mann So;;Text|← Das Sagt Mann So]] \n\n";
	const body = "Body content after links.\n";

	it("removes two leading go-back links (vault format)", () => {
		const content = twoLinks + body;
		const result = goBackLinkHelper.strip(content);
		expect(result).toBe(body.trimStart());
		// Idempotent: stripping again leaves result unchanged
		expect(goBackLinkHelper.strip(result)).toBe(result);
		// No leading go-back link in result
		const firstLine = result.split("\n")[0] ?? "";
		expect(goBackLinkHelper.isMatch(firstLine)).toBe(false);
	});

	it("removes one leading go-back link", () => {
		const content = oneLink + body;
		const result = goBackLinkHelper.strip(content);
		expect(result).toBe(body.trimStart());
		expect(goBackLinkHelper.strip(result)).toBe(result);
	});

	it("returns body unchanged when no leading go-back link", () => {
		expect(goBackLinkHelper.strip(body)).toBe(body);
	});

	it("strips all leading links then returns rest", () => {
		const threeLinks = twoLinks + oneLink;
		const content = threeLinks + body;
		const result = goBackLinkHelper.strip(content);
		expect(result).toBe(body.trimStart());
		expect(goBackLinkHelper.isMatch(result)).toBe(false);
	});

	it("strips link with optional spaces around pipe and arrow (second-run format)", () => {
		// Simulates first-run output that second run must strip
		const linkWithSpaces =
			"[[__;;Das Sagt Mann So;;Text| ← Das Sagt Mann So]]\n\n";
		const content = linkWithSpaces + body;
		const result = goBackLinkHelper.strip(content);
		expect(result).toBe(body.trimStart());
		expect(goBackLinkHelper.isMatch(result)).toBe(false);
	});
});
