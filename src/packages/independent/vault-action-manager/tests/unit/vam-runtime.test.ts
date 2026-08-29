import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";
import type { App } from "obsidian";
import { VamShutdownError, VamVaultIoError } from "../../src/effect/errors";
import { VaultIo } from "../../src/effect/ports";
import { createVamRuntime } from "../../src/effect/runtime";
import { makeVamLive } from "../../src/effect/vam-live";

function makeApp(overrides: { getAbstractFileByPath?: () => never } = {}) {
	return {
		fileManager: {
			renameFile: async () => {},
			trashFile: async () => {},
		},
		metadataCache: {
			getFirstLinkpathDest: () => null,
		},
		vault: {
			create: async () => {
				throw new Error("not used");
			},
			createFolder: async () => {
				throw new Error("not used");
			},
			getAbstractFileByPath:
				overrides.getAbstractFileByPath ?? (() => null),
			getMarkdownFiles: () => [],
			modify: async () => {},
			read: async () => "",
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			setActiveLeaf: () => {},
		},
	} as unknown as App;
}

function typedFailure<E>(exit: Exit.Exit<unknown, E>): E | undefined {
	if (Exit.isSuccess(exit)) return undefined;
	return Option.getOrUndefined(Cause.findErrorOption(exit.cause));
}

describe("VamRuntime", () => {
	it("disposes its live layer finalizers exactly once", async () => {
		let finalizerRuns = 0;
		const runtime = createVamRuntime(
			makeVamLive(makeApp(), {
				onFinalize: () => {
					finalizerRuns++;
				},
			}),
		);

		const initialized = await runtime.runPromiseExit(
			VaultIo.use((vault) => vault.getAbstractFileByPath("Library")),
		);
		expect(Exit.isSuccess(initialized)).toBe(true);

		await Promise.all([runtime.dispose(), runtime.dispose()]);
		await runtime.dispose();

		expect(finalizerRuns).toBe(1);
	});

	it("returns a typed shutdown failure for programs submitted after disposal", async () => {
		const runtime = createVamRuntime(makeVamLive(makeApp()));
		await runtime.dispose();

		const exit = await runtime.runPromiseExit(
			Effect.succeed("unreachable"),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		const failure = typedFailure(exit);
		expect(failure).toBeInstanceOf(VamShutdownError);
		expect((failure as VamShutdownError).cause).toBeInstanceOf(Error);
	});

	it("retains the original cause in VaultIo failures", async () => {
		const original = new Error("lookup failed");
		const runtime = createVamRuntime(
			makeVamLive(
				makeApp({
					getAbstractFileByPath: () => {
						throw original;
					},
				}),
			),
		);

		const exit = await runtime.runPromiseExit(
			VaultIo.use((vault) =>
				vault.getAbstractFileByPath("Library/note.md"),
			),
		);
		await runtime.dispose();

		const failure = typedFailure(exit);
		expect(failure).toBeInstanceOf(VamVaultIoError);
		expect((failure as VamVaultIoError).operation).toBe(
			"getAbstractFileByPath",
		);
		expect((failure as VamVaultIoError).path).toBe("Library/note.md");
		expect((failure as VamVaultIoError).cause).toBe(original);
	});
});
