import { describe, expect, it } from "bun:test";
import { Effect, Layer, Result } from "effect";
import { TFile } from "obsidian";
import { VamVaultIoError } from "../../src/effect/errors";
import { VaultIo } from "../../src/effect/ports";
import { TFileHelper } from "../../src/file-services/background/helpers/tfile-helper";
import type { SplitPathToMdFile } from "../../src/types/split-path";

const target: SplitPathToMdFile = {
	basename: "note",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

type VaultIoImplementation = Parameters<typeof VaultIo.of>[0];

function service(overrides: Partial<VaultIoImplementation> = {}) {
	return Layer.succeed(
		VaultIo,
		VaultIo.of({
			create: () => Effect.die("not used"),
			createFolder: () => Effect.die("not used"),
			getAbstractFileByPath: () => Effect.succeed(null),
			getMarkdownFiles: Effect.succeed([]),
			modify: () => Effect.die("not used"),
			read: () => Effect.die("not used"),
			rename: () => Effect.die("not used"),
			resolveLinkpathDest: () => Effect.die("not used"),
			trash: () => Effect.die("not used"),
			...overrides,
		}),
	);
}

describe("Effect-native TFileHelper", () => {
	it("retries a temporarily missing indexed file", async () => {
		const helper = new TFileHelper();
		const file = new TFile();
		file.path = "Library/note.md";
		let attempts = 0;
		const layer = service({
			getAbstractFileByPath: () =>
				Effect.sync(() => (++attempts < 2 ? null : file)),
		});

		const result = await Effect.runPromise(
			helper.getFileWithRetry(target, 2).pipe(Effect.provide(layer)),
		);

		expect(result).toBe(file);
		expect(attempts).toBe(2);
	});

	it("classifies a missing file as a typed path-aware lookup failure", async () => {
		const helper = new TFileHelper();
		const result = await Effect.runPromise(
			Effect.result(helper.getFile(target)).pipe(
				Effect.provide(service()),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toBeInstanceOf(VamVaultIoError);
			expect(result.failure.operation).toBe("getFile");
			expect(result.failure.path).toBe("Library/note.md");
			expect(String(result.failure.cause)).toContain(
				"Failed to get file by path",
			);
		}
	});

	it("retains a rejecting transform as the cause of a path-aware failure", async () => {
		const helper = new TFileHelper();
		const file = new TFile();
		file.path = "Library/note.md";
		const rejection = new Error("transform rejected");
		const layer = service({
			getAbstractFileByPath: () => Effect.succeed(file),
			read: () => Effect.succeed("before"),
		});

		const result = await Effect.runPromise(
			Effect.result(
				helper.processContent({
					splitPath: target,
					transform: () => Promise.reject(rejection),
				}),
			).pipe(Effect.provide(layer)),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.operation).toBe(
				"processFileContent.transform",
			);
			expect(result.failure.path).toBe("Library/note.md");
			expect((result.failure.cause as Error).cause).toBe(rejection);
		}
	});
});
