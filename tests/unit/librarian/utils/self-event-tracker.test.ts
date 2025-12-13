import { describe, expect, it } from "bun:test";
import { SelfEventTracker } from "../../../../src/commanders/librarian/utils/self-event-tracker";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../../src/types/common-interface/dtos";

const pp = (path: string): PrettyPath => {
	const parts = path.split("/").filter(Boolean);
	const basenameWithExt = parts.pop() ?? "";
	const basename = basenameWithExt.replace(/\.md$/, "");
	return { basename, pathParts: parts };
};

const rename = (from: PrettyPath, to: PrettyPath): LegacyVaultAction => ({
	payload: { from, to },
	type: LegacyVaultActionType.RenameFile,
});

const write = (prettyPath: PrettyPath): LegacyVaultAction => ({
	payload: { content: "", prettyPath },
	type: LegacyVaultActionType.UpdateOrCreateFile,
});

describe("SelfEventTracker", () => {
	it("pops registered rename keys once", () => {
		const tracker = new SelfEventTracker();
		tracker.register([rename(pp("a/b.md"), pp("c/d.md"))]);

		expect(tracker.pop("a/b.md")).toBe(true);
		expect(tracker.pop("c/d.md")).toBe(true);
		expect(tracker.pop("c/d.md")).toBe(false);
	});

	it("tracks write/process/trash keys", () => {
		const tracker = new SelfEventTracker();
		tracker.register([
			write(pp("x/y.md")),
			{ payload: { prettyPath: pp("z.md") }, type: LegacyVaultActionType.TrashFile },
			{
				payload: { prettyPath: pp("w.md"), transform: (s: string) => s },
				type: LegacyVaultActionType.ProcessFile,
			},
		]);

		expect(tracker.pop("x/y.md")).toBe(true);
		expect(tracker.pop("z.md")).toBe(true);
		expect(tracker.pop("w.md")).toBe(true);
	});

	it("normalizes slashes on pop", () => {
		const tracker = new SelfEventTracker();
		tracker.register([write(pp("root/file.md"))]);

		expect(tracker.pop("/root/file.md")).toBe(true);
		expect(tracker.pop("\\root\\file.md")).toBe(false);
	});
});
