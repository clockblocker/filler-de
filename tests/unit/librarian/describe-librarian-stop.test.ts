import { describe, expect, it } from "bun:test";
import {
	MD,
	SplitPathKind,
	VamDispatchError,
	VamScanError,
	VamVaultIoError,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Cause } from "effect";
import {
	describeLibrarianStop,
	isMissingLibraryRoot,
} from "../../../src/commanders/librarian/runtime/describe-librarian-stop";

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
		kind: "io",
		operation: "execute.TrashMdFile",
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

	it("reads a defect held as a cause as its own message, and an interruption as such", () => {
		const died = describeLibrarianStop("Runtime", {
			cause: Cause.die(
				new Error("outer boom", { cause: new Error("inner detail") }),
			),
			operation: "dispatch",
		});
		expect(died).toContain("Reason: outer boom.");

		const interrupted = describeLibrarianStop("Runtime", {
			cause: Cause.interrupt(7),
			operation: "scan",
		});
		expect(interrupted).toContain("Reason: interrupted.");
	});

	it("names every failure and defect of a startup's cause", () => {
		const message = describeLibrarianStop(
			"Startup",
			Cause.combine(
				Cause.fail(
					new VamScanError({
						cause: new Error("permission denied"),
						operation: "scanFolder",
						path: "Library/Soup",
					}),
				),
				Cause.die(new Error("finalizer exploded")),
			),
		);
		expect(message).toContain(
			"Failed: Library/Soup (permission denied). Also: finalizer exploded.",
		);
	});

	it("tells a missing Library folder from a root it could not read", () => {
		const rootScan = (operation: string) =>
			new VamScanError({
				cause: new VamVaultIoError({
					cause: new Error("x"),
					operation,
					path: "Library",
				}),
				operation: "scanRoot",
				path: "Library",
			});

		expect(isMissingLibraryRoot(rootScan("listFolder"))).toBeTrue();
		expect(isMissingLibraryRoot(rootScan("listFolder.decode"))).toBeFalse();
		expect(
			isMissingLibraryRoot(
				new VamScanError({
					cause: new Error("x"),
					operation: "scanFolder",
					path: "Library/Soup",
				}),
			),
		).toBeFalse();
	});
});
