import { describe, expect, it } from "bun:test";
import { SelfEventTracker } from "../../../../src/commanders/librarian/utils/self-event-tracker";
import type { CoreSplitPath } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../../src/obsidian-vault-action-manager/types/vault-action";

const cp = (path: string): CoreSplitPath => {
	const parts = path.split("/").filter(Boolean);
	const basenameWithExt = parts.pop() ?? "";
	const dot = basenameWithExt.lastIndexOf(".");
	const basename = dot === -1 ? basenameWithExt : basenameWithExt.slice(0, dot);
	const pathParts = parts;
	return { basename, pathParts };
};

const rename = (from: CoreSplitPath, to: CoreSplitPath): VaultAction => ({
	payload: { from, to },
	type: VaultActionType.RenameMdFile,
});

const write = (coreSplitPath: CoreSplitPath): VaultAction => ({
	payload: { content: "", coreSplitPath },
	type: VaultActionType.WriteMdFile,
});

describe("SelfEventTracker", () => {
	it("pops registered rename keys once", () => {
		const tracker = new SelfEventTracker();
		tracker.register([rename(cp("a/b.md"), cp("c/d.md"))]);

		expect(tracker.pop("a/b.md")).toBe(true);
		expect(tracker.pop("c/d.md")).toBe(true);
		expect(tracker.pop("c/d.md")).toBe(false);
	});

	it("tracks write/process/trash keys", () => {
		const tracker = new SelfEventTracker();
		tracker.register([
			write(cp("x/y.md")),
			{ payload: { coreSplitPath: cp("z.md") }, type: VaultActionType.TrashMdFile },
			{
				payload: { coreSplitPath: cp("w.md"), transform: (s: string) => s },
				type: VaultActionType.ProcessMdFile,
			},
		]);

		expect(tracker.pop("x/y.md")).toBe(true);
		expect(tracker.pop("z.md")).toBe(true);
		expect(tracker.pop("w.md")).toBe(true);
	});

	it("normalizes slashes on pop", () => {
		const tracker = new SelfEventTracker();
		tracker.register([write(cp("root/file.md"))]);

		expect(tracker.pop("/root/file.md")).toBe(true);
		expect(tracker.pop("\\root\\file.md")).toBe(false);
	});
});
