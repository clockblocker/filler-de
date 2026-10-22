import { describe, expect, it } from "bun:test";
import {
	type ProtectedModificationOrigin,
	type ProtectedPathModification,
	type SplitPathToMdFile,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { describeProtectedModifications } from "../../../src/managers/obsidian/protected-paths/protected-paths-guard";

const modification = (
	path: string,
	origin: ProtectedModificationOrigin,
): ProtectedPathModification => ({
	origin,
	prefix: "Exemplar",
	splitPath: splitPathCodec.parse(path) as SplitPathToMdFile,
	stat: { ctime: 1, mtime: 2, size: 3 },
});

const NOTE = "Exemplar/Kohlekraftwerk/Kohlekraftwerk.md";
const SOURCE = "Exemplar/Kohlekraftwerk/Quelle.md";

describe("describeProtectedModifications", () => {
	it("stays quiet for the user's own editing", () => {
		expect(
			describeProtectedModifications([modification(NOTE, "OpenInEditor")]),
		).toBeNull();
	});

	it("names a file rewritten after a Textfresser rename", () => {
		expect(
			describeProtectedModifications([
				modification(NOTE, "VamRenameLinkUpdate"),
			]),
		).toBe(
			`Textfresser: the protected file ${NOTE} was changed by Obsidian's link updating, after a Textfresser rename. Check it against the checksum.`,
		);
	});

	it("names every suspicious file and leaves out the edited one", () => {
		expect(
			describeProtectedModifications([
				modification(NOTE, "Unattributed"),
				modification("Exemplar/Notes.md", "OpenInEditor"),
				modification(SOURCE, "VamRenameLinkUpdate"),
			]),
		).toBe(
			`Textfresser: 2 protected files: ${NOTE}, ${SOURCE} were changed by something other than your editing (Obsidian's link updating, Sync, or another plugin). Check them against the checksum.`,
		);
	});
});
