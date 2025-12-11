import { describe, expect, it } from "bun:test";
import {
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../../../../src/commanders/librarian/indexing/codecs";
import {
	corePathToTreePath,
	treePathToCorePath,
} from "../../../../src/commanders/librarian/utils/path-conversions";

describe("path-conversions", () => {
	it("returns root codex for empty tree path", () => {
		const pretty = treePathToCorePath([], "Library");
		expect(pretty).toEqual({
			basename: treePathToCodexBasename.encode(["Library"]),
			pathParts: ["Library"],
		});
	});

	it("round-trips scroll paths", () => {
		const treePath = ["Section", "Note"];
		const pretty = treePathToCorePath(treePath, "Library");
		expect(pretty.basename).toBe(treePathToScrollBasename.encode(treePath));
		expect(pretty.pathParts).toEqual(["Library", "Section"]);

		const back = corePathToTreePath(pretty);
		expect(back).toEqual(treePath);
	});

	it("round-trips page paths", () => {
		const treePath = ["Section", "Book", "000"];
		const pretty = treePathToCorePath(treePath, "Library");
		expect(pretty.basename).toBe(treePathToPageBasename.encode(treePath));

		const back = corePathToTreePath(pretty);
		expect(back).toEqual(treePath);
	});

	it("falls back to sanitized path when canonicalization fails", () => {
		const pretty = { basename: "Weird?", pathParts: ["OtherRoot", "Bad"] };
		const treePath = corePathToTreePath(pretty);
		expect(treePath).toEqual(["Bad", "Weird?"]);
	});
});
