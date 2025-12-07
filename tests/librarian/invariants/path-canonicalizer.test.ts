import { describe, expect, it } from "bun:test";
import {
	canonicalizePrettyPath,
	isCanonical,
} from "../../../src/commanders/librarian/invariants/path-canonicalizer";

describe("path-canonicalizer", () => {
	const rootName: "Library" = "Library";

	it("adds parent suffix when basename lacks ancestry", () => {
		const prettyPath = {
			basename: "NewNote",
			pathParts: [rootName, "Section"],
		};

		const result = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPrettyPath.basename).toBe("NewNote-Section");
		expect(result.canonicalPrettyPath.pathParts).toEqual([
			rootName,
			"Section",
		]);
		expect(result.treePath).toEqual(["Section", "NewNote"]);
		expect(isCanonical(prettyPath, result.canonicalPrettyPath)).toBe(false);
	});

	it("moves encoded ancestry into folders", () => {
		const prettyPath = {
			basename: "Note-Child-Parent",
			pathParts: [rootName, "Parent"],
		};

		const result = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPrettyPath.basename).toBe("Note-Parent");
		expect(result.canonicalPrettyPath.pathParts).toEqual([rootName, "Parent"]);
		expect(result.treePath).toEqual(["Parent", "Note"]);
	});

	it("leaves canonical codex intact", () => {
		const prettyPath = {
			basename: "__Library",
			pathParts: [rootName],
		};

		const result = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(isCanonical(prettyPath, result.canonicalPrettyPath)).toBe(true);
	});

	it("uses actual folder when basename ancestry is stale", () => {
		const prettyPath = {
			basename: "test-bar-bas-Fairy_Tales",
			pathParts: [rootName, "Fairy_Tales", "bar"],
		};

		const result = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPrettyPath.pathParts).toEqual([
			rootName,
			"Fairy_Tales",
			"bar",
		]);
		expect(result.canonicalPrettyPath.basename).toBe("test-bar-Fairy_Tales");
		expect(result.treePath).toEqual(["Fairy_Tales", "bar", "test"]);
	});
});
