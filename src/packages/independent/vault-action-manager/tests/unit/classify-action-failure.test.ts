import { describe, expect, it } from "bun:test";
import { classifyActionFailure } from "../../src/effect/dispatch-report";
import {
	VamActiveEditorError,
	VamContentConflictError,
	VamNoActiveEditorError,
	VamTargetExistsError,
	VamVaultIoError,
} from "../../src/effect/errors";

const cause = new Error("failed");

describe("classifyActionFailure", () => {
	it("reads a lost background content race as a conflict", () => {
		expect(
			classifyActionFailure(
				new VamContentConflictError({
					cause,
					operation: "processFileContent.revalidate",
					path: "Library/Note.md",
				}),
			),
		).toBe("conflict");
	});

	it("reads a taken target as exists", () => {
		expect(
			classifyActionFailure(
				new VamTargetExistsError({
					cause,
					occupiedBy: "Library/Note.md",
					operation: "createFile.exists",
					path: "Library/note.md",
				}),
			),
		).toBe("exists");
	});

	it("reads an editor that moved on before the write as a conflict", () => {
		for (const reason of ["IdentityMismatch", "StaleFile"] as const) {
			expect(
				classifyActionFailure(
					new VamActiveEditorError({
						cause,
						operation: "processActiveContent.revalidate",
						reason,
					}),
				),
			).toBe("conflict");
		}
	});

	it("reads a failure after the vault changed as I/O, whatever its reason", () => {
		expect(
			classifyActionFailure(
				new VamActiveEditorError({
					cause,
					operation: "renameFile.restoreSelection",
					reason: "IdentityMismatch",
					stateChanged: true,
				}),
			),
		).toBe("io");
		expect(
			classifyActionFailure(
				new VamVaultIoError({
					cause,
					operation: "getFile",
					stateChanged: true,
				}),
			),
		).toBe("io");
	});

	it("reads a lookup miss as missing", () => {
		for (const operation of [
			"getFile",
			"getFolder",
			"renameFile.resolve",
			"renameFolder.resolve",
		]) {
			expect(
				classifyActionFailure(
					new VamVaultIoError({ cause, operation }),
				),
			).toBe("missing");
		}
	});

	it("reads other vault and editor failures as I/O", () => {
		expect(
			classifyActionFailure(
				new VamVaultIoError({ cause, operation: "renameFile" }),
			),
		).toBe("io");
		expect(
			classifyActionFailure(
				new VamActiveEditorError({
					cause,
					operation: "processActiveContent.write",
					reason: "WriteFailure",
				}),
			),
		).toBe("io");
		expect(
			classifyActionFailure(
				new VamNoActiveEditorError({ cause, operation: "snapshot" }),
			),
		).toBe("io");
	});

	it("reads anything else as a defect", () => {
		expect(classifyActionFailure(new Error("thrown"))).toBe("defect");
	});
});
