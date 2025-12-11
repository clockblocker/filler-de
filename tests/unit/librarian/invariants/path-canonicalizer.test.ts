import { describe, expect, it } from "bun:test";
import {
	canonicalizePath,
	computeCanonicalPath,
	decodeBasename,
	isCanonical,
} from "../../../../src/commanders/librarian/invariants/path-canonicalizer";

describe("path-canonicalizer", () => {
	const rootName: "Library" = "Library";

	it("adds parent suffix when basename lacks ancestry", () => {
		const prettyPath = {
			basename: "NewNote",
			pathParts: [rootName, "Section"],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPath.basename).toBe("NewNote-Section");
		expect(result.canonicalPath.pathParts).toEqual([
			rootName,
			"Section",
		]);
		expect(result.treePath).toEqual(["Section", "NewNote"]);
		expect(isCanonical(prettyPath, result.canonicalPath)).toBe(false);
	});

	it("moves encoded ancestry into folders", () => {
		const prettyPath = {
			basename: "Note-Child-Parent",
			pathParts: [rootName, "Parent"],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPath.basename).toBe("Note-Parent");
		expect(result.canonicalPath.pathParts).toEqual([rootName, "Parent"]);
		expect(result.treePath).toEqual(["Parent", "Note"]);
	});

	it("leaves canonical codex intact", () => {
		const prettyPath = {
			basename: "__Library",
			pathParts: [rootName],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(isCanonical(prettyPath, result.canonicalPath)).toBe(true);
	});

	it("uses actual folder when basename ancestry is stale", () => {
		const prettyPath = {
			basename: "test-bar-bas-Fairy_Tales",
			pathParts: [rootName, "Fairy_Tales", "bar"],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPath.pathParts).toEqual([
			rootName,
			"Fairy_Tales",
			"bar",
		]);
		expect(result.canonicalPath.basename).toBe("test-bar-Fairy_Tales");
		expect(result.treePath).toEqual(["Fairy_Tales", "bar", "test"]);
	});

	it("keeps codex in its folder when name matches", () => {
		const prettyPath = {
			basename: "__foo",
			pathParts: [rootName, "bar", "foo"],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPath.pathParts).toEqual([
			rootName,
			"bar",
			"foo",
		]);
		expect(result.canonicalPath.basename).toBe("__foo-bar");
	});

	it("decodes basenames for all kinds", () => {
		expect(decodeBasename("__Library")?.kind).toBe("codex");
		expect(decodeBasename("000-book-note")?.kind).toBe("page");
		expect(decodeBasename("note-parent")?.kind).toBe("scroll");
	});

	it("uses basename authority to move into encoded path", () => {
		const decoded = decodeBasename("test1-bar-bas");
		if (!decoded) throw new Error("expected decoded");

		const result = computeCanonicalPath({
			authority: "basename",
			currentPath: {
				basename: "test1-bar-bas",
				pathParts: [rootName, "foo"],
			},
			decoded,
			folderPath: [],
			rootName,
		});

		expect(result.canonicalPath.pathParts).toEqual([
			rootName,
			"bas",
			"bar",
		]);
		expect(result.canonicalPath.basename).toBe("test1-bar-bas");
	});

	it("converts page to parent folders when folder authority", () => {
		const prettyPath = {
			basename: "000-book-foo",
			pathParts: [rootName, "foo"],
		};

		const result = canonicalizePath({ path: prettyPath, rootName });
		if ("reason" in result) throw new Error("unexpected quarantine");

		expect(result.canonicalPath.pathParts).toEqual([
			rootName,
			"foo",
		]);
		expect(result.canonicalPath.basename).toBe("000-foo");
		expect(result.treePath).toEqual(["foo", "000"]);
	});
});
