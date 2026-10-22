import { describe, expect, it } from "bun:test";
import {
	type ProtectedModificationWriter,
	type ProtectedPathModification,
	type SplitPathToMdFile,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	describeProtectedModifications,
	type ProtectedPathWarning,
	protectedPathRefusal,
	watchProtectedPaths,
} from "../../../src/managers/obsidian/protected-paths/protected-paths-guard";

const modification = (
	path: string,
	writer: ProtectedModificationWriter,
): ProtectedPathModification => ({
	origin:
		writer === "VamRenameLinkUpdate"
			? { basis: "Timing", kind: "LinkUpdate", operationId: "librarian#1" }
			: writer === "RestoredAfterLinkUpdate"
				? {
						basis: "Predicted",
						kind: "LinkUpdate",
						operationId: "dictionary#1",
					}
				: { kind: "External" },
	prefix: "Exemplar",
	...(writer === "RestoredAfterLinkUpdate"
		? { renamed: { from: "Worter/Kraftwerk.md", to: "Worter/k/Kraftwerk.md" } }
		: {}),
	splitPath: splitPathCodec.parse(path) as SplitPathToMdFile,
	stat: { ctime: 1, mtime: 2, size: 3 },
	writer,
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

	it("names a file put back after Obsidian's link updating rewrote it, and the note it links to", () => {
		expect(
			describeProtectedModifications([
				modification(NOTE, "RestoredAfterLinkUpdate"),
			]),
		).toBe(
			`Textfresser: the protected file ${NOTE} links to Worter/Kraftwerk.md, which Textfresser moved to Worter/k/Kraftwerk.md. Obsidian's link updating rewrote that link; Textfresser put the file back as it was, so the link keeps its old text.`,
		);
	});

	it("names restored files apart from changed ones", () => {
		expect(
			describeProtectedModifications([
				modification(NOTE, "RestoredAfterLinkUpdate"),
				modification(SOURCE, "RestoredAfterLinkUpdate"),
				modification("Exemplar/Notes.md", "VamRenameLinkUpdate"),
			]),
		).toBe(
			`Textfresser: the protected file Exemplar/Notes.md was changed by Obsidian's link updating, after a Textfresser rename. Check it against the checksum. Obsidian's link updating rewrote 2 protected files: ${NOTE}, ${SOURCE} after Textfresser moved notes they link to; Textfresser put them back as they were, so those links keep their old text.`,
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

describe("protectedPathRefusal", () => {
	const vam = {
		protectedPrefixOf: (path: string) =>
			path.startsWith("Exemplar/") ? "Exemplar" : undefined,
	};

	it("says why a protected path is not written", () => {
		expect(protectedPathRefusal(vam, SOURCE)).toBe(
			`Textfresser does not write to ${SOURCE}: it lies in the protected folder Exemplar/`,
		);
	});

	it("lets any other path through", () => {
		expect(protectedPathRefusal(vam, "Library/Story.md")).toBeUndefined();
	});
});

describe("watchProtectedPaths", () => {
	const watch = async () => {
		let deliver: (modifications: ProtectedPathModification[]) => void = () => {};
		const opened: string[] = [];
		const updates: string[] = [];
		let showing = true;
		const vam = {
			subscribeToProtectedPathModifications: (
				handler: (event: {
					readonly modifications: readonly ProtectedPathModification[];
				}) => Effect.Effect<void>,
			) => {
				deliver = (modifications) => Effect.runSync(handler({ modifications }));
				return Effect.succeed({ caughtUp: Effect.void, close: Effect.void });
			},
		};
		await Effect.runPromise(
			watchProtectedPaths(vam, (message): ProtectedPathWarning => {
				opened.push(message);
				return { showing: () => showing, update: (next) => updates.push(next) };
			}),
		);
		return {
			deliver: (modifications: ProtectedPathModification[]) => deliver(modifications),
			dismiss: () => {
				showing = false;
			},
			opened,
			updates,
		};
	};

	it("raises one warning for changes over several windows while it shows", async () => {
		const { deliver, opened, updates } = await watch();
		deliver([modification(NOTE, "OpenInEditor")]);
		expect(opened).toEqual([]);
		deliver([modification(NOTE, "VamRenameLinkUpdate")]);
		deliver([modification(SOURCE, "VamRenameLinkUpdate")]);
		deliver([modification(NOTE, "VamRenameLinkUpdate")]);
		expect(opened).toHaveLength(1);
		expect(updates.at(-1)).toBe(
			`Textfresser: 2 protected files: ${NOTE}, ${SOURCE} were changed by Obsidian's link updating, after a Textfresser rename. Check them against the checksum.`,
		);
	});

	it("opens a fresh warning naming only new changes once one is dismissed", async () => {
		const { deliver, dismiss, opened } = await watch();
		deliver([modification(NOTE, "Unattributed")]);
		dismiss();
		deliver([modification(SOURCE, "Unattributed")]);
		expect(opened).toHaveLength(2);
		expect(opened[1]).toContain(`the protected file ${SOURCE} was changed`);
	});

	it("names at most ten files and counts the rest", () => {
		const many = Array.from({ length: 12 }, (_, index) =>
			modification(`Exemplar/Note ${index}.md`, "Unattributed"),
		);
		const message = describeProtectedModifications(many) ?? "";
		expect(message).toContain("12 protected files:");
		expect(message).toContain("Exemplar/Note 9.md and 2 more");
		expect(message).not.toContain("Exemplar/Note 10.md");
	});
});
