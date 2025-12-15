import { describe, expect, it } from "bun:test";
import {
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "../../../../src/commanders/librarian/indexing/codecs";
import { canonicalizePrettyPathLegacy } from "../../../../src/commanders/librarian/invariants/path-canonicalizer";
import { prettyPathToTreePathLegacyLegacy, treePathToPrettyPathLegacy } from "../../../../src/commanders/librarian/utils/path-conversions";

describe("path-conversions", () => {
	it("returns root codex for empty tree path", () => {
		const pretty = treePathToPrettyPathLegacy([], "Library");
		expect(pretty).toEqual({
			basename: treePathToCodexBasename.encode(["Library"]),
			pathParts: ["Library"],
		});
	});

	it("round-trips scroll paths", () => {
		const treePath = ["Section", "Note"];
		const pretty = treePathToPrettyPathLegacy(treePath, "Library");
		expect(pretty.basename).toBe(treePathToScrollBasename.encode(treePath));
		expect(pretty.pathParts).toEqual(["Library", "Section"]);

		const back = prettyPathToTreePathLegacyLegacy(pretty);
		expect(back).toEqual(treePath);
	});

	it("round-trips page paths", () => {
		const treePath = ["Section", "Book", "000"];
		const pretty = treePathToPrettyPathLegacy(treePath, "Library");
		expect(pretty.basename).toBe(treePathToPageBasenameLegacy.encode(treePath));

		const back = prettyPathToTreePathLegacyLegacy(pretty);
		expect(back).toEqual(treePath);
	});

	it("falls back to sanitized path when canonicalization fails", () => {
		const pretty = { basename: "Weird?", pathParts: ["OtherRoot", "Bad"] };
		const treePath = prettyPathToTreePathLegacyLegacy(pretty);
		expect(treePath).toEqual(["Bad", "Weird?"]);
	});
});
