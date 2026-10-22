import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { MD } from "../../src/types/literals";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../src/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../src/types/vault-action";

const NFC = "Mütter";
const NFD = "Mütter";

const folder = (basename: string, pathParts: string[] = []) =>
	({
		basename,
		kind: SplitPathKind.Folder,
		pathParts,
	}) satisfies SplitPathToFolder;

const mdFile = (basename: string, pathParts: string[] = []) =>
	({
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts,
	}) satisfies SplitPathToMdFile;

function makeTracker(actions: readonly VaultAction[]) {
	const tracker = Effect.runSync(SelfEventTracker.makeEffect());
	Effect.runSync(tracker.registerEffect(actions));
	return (path: string) => Effect.runSync(tracker.shouldIgnoreEffect(path));
}

describe("SelfEventTracker path identity", () => {
	it("matches the NFC path Obsidian reports for an NFD action path", () => {
		const shouldIgnore = makeTracker([
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { splitPath: mdFile(NFD, ["Worter"]) },
			},
		]);
		expect(shouldIgnore(`Worter/${NFC}.md`)).toBe(true);
	});

	it("matches descendants of a renamed folder whatever their composition", () => {
		const shouldIgnore = makeTracker([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder(NFD, ["Library"]),
					to: folder("Other", ["Library"]),
				},
			},
		]);
		expect(shouldIgnore(`Library/${NFC}/child.md`)).toBe(true);
		expect(shouldIgnore(`Library/${NFC}er/child.md`)).toBe(false);
	});

	it("stays case-sensitive, so a rename that changes only case expects both ends", () => {
		const shouldIgnore = makeTracker([
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("note", ["Library"]),
					to: mdFile("Note", ["Library"]),
				},
			},
		]);
		expect(shouldIgnore("Library/Note.md")).toBe(true);
		expect(shouldIgnore("Library/note.md")).toBe(true);
		expect(shouldIgnore("Library/NOTE.md")).toBe(false);
	});
});
