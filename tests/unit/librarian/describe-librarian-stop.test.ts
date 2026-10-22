import { describe, expect, it } from "bun:test";
import {
	MD,
	SplitPathKind,
	VamDispatchError,
	VamScanError,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { describeLibrarianStop } from "../../../src/commanders/librarian/runtime/describe-librarian-stop";

function trash(basename: string): VamDispatchError {
	return new VamDispatchError({
		action: {
			kind: VaultActionKind.TrashMdFile,
			payload: {
				splitPath: {
					basename,
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
			},
		},
		cause: new Error("locked"),
		operation: "executeAction",
	});
}

describe("describeLibrarianStop", () => {
	it("lists three failed files and counts the rest", () => {
		const message = describeLibrarianStop(
			"Runtime",
			["A", "B", "C", "D", "E"].map(trash),
		);

		expect(message).toContain(
			"Failed: Library/A.md (locked); Library/B.md (locked); Library/C.md (locked); and 2 more.",
		);
		expect(message).toContain("Fix or move these files");
		expect(message).not.toContain("rescan");
	});

	it("names the scan failure that stopped startup", () => {
		const message = describeLibrarianStop(
			"Startup",
			new VamScanError({
				cause: new Error("permission denied"),
				operation: "scanRoot",
				path: "Library",
			}),
		);

		expect(message).toContain("at startup");
		expect(message).toContain("Library (permission denied)");
	});

	it("gives the reason and the retry when no file is to blame", () => {
		const message = describeLibrarianStop("Startup", {
			cause: new Error("tree out of sync"),
			kind: "DerivationFailed",
		});

		expect(message).toContain("Reason: tree out of sync.");
		expect(message).toContain(
			'Run "Restart Librarian" from the command palette to try again.',
		);
	});
});
