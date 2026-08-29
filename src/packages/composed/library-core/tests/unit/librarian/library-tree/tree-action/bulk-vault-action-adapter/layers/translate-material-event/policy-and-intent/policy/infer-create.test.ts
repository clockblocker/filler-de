import { describe, expect, it } from "bun:test";
import { MD, SplitPathKind } from "@textfresser/vault-action-manager";
import { ChangePolicy } from "../../../../../../../../../../src/tree/change-policy";
import { inferCreatePolicy } from "../../../../../../../../../../src/tree/create-policy";

// Helper: create library-scoped split paths
const spMdFile = (
	pathParts: string[],
	basename: string,
): {
	basename: string;
	pathParts: string[];
	kind: typeof SplitPathKind.MdFile;
	extension: MD;
} => ({
	basename,
	extension: MD,
	kind: SplitPathKind.MdFile,
	pathParts,
});

describe("inferCreatePolicy", () => {
	it('spMdFile(["Library"], "Note-Child-Parent") => NameKing', () => {
		const splitPath = spMdFile(["Library"], "Note-Child-Parent");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.NameKing);
	});

	it('spMdFile(["Library", "Parent"], "Note") => PathKing (nested)', () => {
		const splitPath = spMdFile(["Library", "Parent"], "Note");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.PathKing);
	});

	it('spMdFile(["Library", "Parent", "Child"], "Note") => PathKing (deeply nested)', () => {
		const splitPath = spMdFile(["Library", "Parent", "Child"], "Note");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.PathKing);
	});
});
