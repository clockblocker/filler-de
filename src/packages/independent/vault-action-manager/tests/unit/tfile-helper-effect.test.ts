import { describe, expect, it } from "bun:test";
import { Effect, Layer, Result } from "effect";
import { TFile } from "obsidian";
import {
	VamContentConflictError,
	VamVaultIoError,
} from "../../src/effect/errors";
import { VaultIo } from "../../src/effect/ports";
import { TFileHelper } from "../../src/file-services/background/helpers/tfile-helper";
import { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
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
			process: () => Effect.die("not used"),
			read: () => Effect.die("not used"),
			rename: () => Effect.die("not used"),
			resolveLinkpathDest: () => Effect.die("not used"),
			stat: () => Effect.die("not used"),
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
		const rejection = new Error("transform rejected");
		const vault = processVault("before");

		const result = await runProcess(vault, () => Promise.reject(rejection));

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.operation).toBe(
				"processFileContent.transform",
			);
			expect(result.failure.path).toBe("Library/note.md");
			expect((result.failure.cause as Error).cause).toBe(rejection);
		}
		expect(vault.content()).toBe("before");
		expect(vault.writes()).toBe(0);
	});

	it("applies a synchronous transform atomically through one Vault.process call", async () => {
		const vault = processVault("before");

		const result = await runProcess(vault, (content) => `${content}!`);

		expect(Result.isSuccess(result)).toBe(true);
		expect(vault.content()).toBe("before!");
		expect(vault.processCalls()).toBe(1);
		expect(vault.writes()).toBe(1);
	});

	it("does not write when a synchronous transform leaves content unchanged", async () => {
		const vault = processVault("same");

		const result = await runProcess(vault, (content) => content);

		expect(Result.isSuccess(result)).toBe(true);
		expect(vault.writes()).toBe(0);
	});

	it("attributes a throwing synchronous transform without writing", async () => {
		const thrown = new Error("transform threw");
		const vault = processVault("before");

		const result = await runProcess(vault, () => {
			throw thrown;
		});

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.operation).toBe(
				"processFileContent.transform",
			);
			expect((result.failure.cause as Error).cause).toBe(thrown);
		}
		expect(vault.writes()).toBe(0);
	});

	it("writes an asynchronous transform after re-checking unchanged content", async () => {
		const vault = processVault("before");

		const result = await runProcess(
			vault,
			async (content) => `${content}!`,
		);

		expect(Result.isSuccess(result)).toBe(true);
		expect(vault.content()).toBe("before!");
		expect(vault.processCalls()).toBe(2);
		expect(vault.writes()).toBe(1);
	});

	it("fails with a typed conflict and keeps a user edit made during an asynchronous transform", async () => {
		const vault = processVault("before");

		const result = await runProcess(vault, async (content) => {
			vault.edit("user edit");
			return `${content}!`;
		});

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toBeInstanceOf(VamContentConflictError);
			expect(result.failure.operation).toBe(
				"processFileContent.revalidate",
			);
			expect(result.failure.path).toBe("Library/note.md");
		}
		expect(vault.content()).toBe("user edit");
		expect(vault.writes()).toBe(0);
	});
});

function processVault(initial: string) {
	const file = new TFile();
	file.path = "Library/note.md";
	let content = initial;
	let processCalls = 0;
	let writes = 0;
	const layer = service({
		getAbstractFileByPath: () => Effect.succeed(file),
		process: (target, fn) =>
			Effect.try({
				catch: (cause) =>
					new VamVaultIoError({
						cause,
						operation: "process",
						path: target.path,
					}),
				// Mirrors Obsidian's adapter: read, call `fn`, and write only
				// when it returns something other than what was read.
				try: () => {
					processCalls++;
					const read = content;
					const next = fn(read);
					if (next === read) return read;
					writes++;
					content = next;
					return next;
				},
			}),
	});
	return {
		content: () => content,
		edit: (next: string) => {
			content = next;
		},
		layer,
		processCalls: () => processCalls,
		writes: () => writes,
	};
}

function runProcess(
	vault: ReturnType<typeof processVault>,
	transform: (content: string) => string | Promise<string>,
) {
	return Effect.runPromise(
		Effect.result(
			new TFileHelper().processContent({ splitPath: target, transform }),
		).pipe(Effect.provide(vault.layer)),
	);
}

describe("TFileHelper modify Self Events", () => {
	function recordingHelper(initial = "before") {
		const log: string[] = [];
		const helper = new TFileHelper({
			expectModifyEffect: (path) =>
				Effect.sync(() => log.push(`expect ${path}`)),
			forgetModifyEffect: (path) =>
				Effect.sync(() => log.push(`forget ${path}`)),
		});
		const file = new TFile();
		file.path = "Library/note.md";
		let content = initial;
		const layer = service({
			getAbstractFileByPath: () => Effect.succeed(file),
			modify: (target, next) =>
				Effect.sync(() => {
					content = next;
					log.push(`modify ${target.path}`);
				}),
			// Mirrors Obsidian's adapter: write only when `fn` changes the
			// content it was given.
			process: (target, fn) =>
				Effect.sync(() => {
					const read = content;
					const next = fn(read);
					if (next === read) return read;
					content = next;
					log.push(`process-write ${target.path}`);
					return next;
				}),
			read: () => Effect.sync(() => content),
		});
		return {
			edit: (next: string) => {
				content = next;
			},
			helper,
			layer,
			log,
		};
	}

	it("expects a modify callback immediately before each background write", async () => {
		const { helper, layer, log } = recordingHelper();

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* helper.replaceAllContent(target, "replaced");
				yield* helper.processContent({
					splitPath: target,
					transform: (content) => `${content}!`,
				});
			}).pipe(Effect.provide(layer)),
		);

		expect(log).toEqual([
			"expect Library/note.md",
			"modify Library/note.md",
			"expect Library/note.md",
			"process-write Library/note.md",
		]);
	});

	it("expects nothing when a transform leaves the content unchanged", async () => {
		const { helper, layer, log } = recordingHelper("same");

		await Effect.runPromise(
			helper
				.processContent({ splitPath: target, transform: (c) => c })
				.pipe(Effect.provide(layer)),
		);

		expect(log).toEqual([]);
	});

	it("attributes only the revalidated write of an asynchronous transform", async () => {
		const { helper, layer, log } = recordingHelper();

		await Effect.runPromise(
			helper
				.processContent({
					splitPath: target,
					transform: async (content) => `${content}!`,
				})
				.pipe(Effect.provide(layer)),
		);

		expect(log).toEqual([
			"expect Library/note.md",
			"process-write Library/note.md",
		]);
	});

	it("expects nothing when an asynchronous transform loses a content race", async () => {
		const { edit, helper, layer, log } = recordingHelper();

		const result = await Effect.runPromise(
			Effect.result(
				helper.processContent({
					splitPath: target,
					transform: async (content) => {
						await Promise.resolve();
						edit("user edit");
						return `${content}!`;
					},
				}),
			).pipe(Effect.provide(layer)),
		);

		expect(Result.isFailure(result)).toBe(true);
		expect(log).toEqual([]);
	});

	it("withdraws the expectation when the write fails", async () => {
		const { helper, log } = recordingHelper();
		const file = new TFile();
		file.path = "Library/note.md";
		const layer = service({
			getAbstractFileByPath: () => Effect.succeed(file),
			modify: () =>
				Effect.fail(
					new VamVaultIoError({
						cause: new Error("disk full"),
						operation: "modify",
						path: file.path,
					}),
				),
			read: () => Effect.succeed("before"),
		});

		const result = await Effect.runPromise(
			Effect.result(helper.replaceAllContent(target, "x")).pipe(
				Effect.provide(layer),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		expect(log).toEqual([
			"expect Library/note.md",
			"forget Library/note.md",
		]);
	});
});

describe("TFileHelper modify Self Events with a real tracker", () => {
	function trackedVault(initial: string) {
		const tracker = Effect.runSync(SelfEventTracker.makeEffect());
		const helper = new TFileHelper(tracker);
		const file = new TFile();
		file.path = "Library/note.md";
		let content = initial;
		const foreignIgnored: boolean[] = [];
		let failWrite = false;
		const layer = service({
			getAbstractFileByPath: () => Effect.succeed(file),
			// A hand edit's modify callback lands after Obsidian read the
			// file and before it calls `fn`.
			process: (target, fn) =>
				Effect.gen(function* () {
					const read = content;
					foreignIgnored.push(
						yield* tracker.shouldIgnoreModifyEffect(target.path),
					);
					const next = fn(read);
					if (next === read) return read;
					if (failWrite) {
						return yield* new VamVaultIoError({
							cause: new Error("disk full"),
							operation: "process",
							path: target.path,
						});
					}
					content = next;
					return next;
				}),
		});
		return {
			failWrites: () => {
				failWrite = true;
			},
			foreignIgnored,
			helper,
			layer,
			selfIgnored: () =>
				Effect.runSync(tracker.shouldIgnoreModifyEffect(file.path)),
		};
	}

	it("never hides a foreign modify that fires during a no-op process", async () => {
		const vault = trackedVault("same");

		await Effect.runPromise(
			vault.helper
				.processContent({ splitPath: target, transform: (c) => c })
				.pipe(Effect.provide(vault.layer)),
		);

		expect(vault.foreignIgnored).toEqual([false]);
		expect(vault.selfIgnored()).toBe(false);
	});

	it("attributes exactly the write a process call makes", async () => {
		const vault = trackedVault("before");

		await Effect.runPromise(
			vault.helper
				.processContent({
					splitPath: target,
					transform: (c) => `${c}!`,
				})
				.pipe(Effect.provide(vault.layer)),
		);

		expect(vault.foreignIgnored).toEqual([false]);
		expect(vault.selfIgnored()).toBe(true);
		expect(vault.selfIgnored()).toBe(false);
	});

	it("withdraws the expectation when the process write fails", async () => {
		const vault = trackedVault("before");
		vault.failWrites();

		const result = await Effect.runPromise(
			Effect.result(
				vault.helper.processContent({
					splitPath: target,
					transform: (c) => `${c}!`,
				}),
			).pipe(Effect.provide(vault.layer)),
		);

		expect(Result.isFailure(result)).toBe(true);
		expect(vault.selfIgnored()).toBe(false);
	});
});
