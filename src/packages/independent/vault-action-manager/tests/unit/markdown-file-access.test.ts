import { describe, expect, it, mock } from "bun:test";
import { Effect, Fiber, Layer, Tracer } from "effect";
import { TFile } from "obsidian";
import { VamActiveEditorError } from "../../src/effect/errors";
import {
	ActiveEditorAccess,
	type ActiveEditorHandle,
	type SavedInlineTitleSelection,
	VaultIo,
} from "../../src/effect/ports";
import { ActiveFileService } from "../../src/file-services/active-view/active-file-service";
import { TFileHelper } from "../../src/file-services/background/helpers/tfile-helper";
import { MarkdownFileAccess } from "../../src/file-services/markdown-file-access";
import type { SplitPathToMdFile } from "../../src/types/split-path";

const target: SplitPathToMdFile = {
	basename: "note",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

const renamedTarget: SplitPathToMdFile = {
	...target,
	basename: "renamed",
};

function makeFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	const filename = path.split("/").at(-1) ?? path;
	file.extension = filename.split(".").at(-1) ?? "";
	file.basename = filename.slice(0, -(file.extension.length + 1));
	return file;
}

function makeHarness(
	options: {
		activePath?: string | null;
		mode?: string;
		selection?: string;
	} = {},
) {
	const files = new Map<string, TFile>();
	const targetFile = makeFile("Library/note.md");
	const otherFile = makeFile("Library/other.md");
	files.set(targetFile.path, targetFile);
	files.set(otherFile.path, otherFile);

	let activeFile =
		options.activePath === null
			? null
			: options.activePath === otherFile.path
				? otherFile
				: targetFile;
	let content = "editor content";
	let current = true;
	let mode = options.mode ?? "source";
	let exposeMissingFile = false;
	let observationFailure: VamActiveEditorError | null = null;
	let readinessFailure: VamActiveEditorError | null = null;
	let restoreFailure: Error | null = null;
	let afterVaultLookup: (() => void) | null = null;
	let inlineTitleSelection: SavedInlineTitleSelection | null = {
		end: 4,
		start: 1,
		text: "note",
	};
	let restoredInlineTitleSelection: SavedInlineTitleSelection | null = null;
	let observationCount = 0;
	let readinessCount = 0;
	let readinessDelayMs = 0;
	let lastExpectedInlineTitleText: string | undefined;
	let transactionCount = 0;
	let scrollCount = 0;
	const vaultContents = new Map<string, string>();
	const vaultRead = mock((file: TFile) =>
		Effect.succeed(vaultContents.get(file.path) ?? "vault content"),
	);

	const editor = {
		getCursor: (_side?: "from" | "to" | "head" | "anchor") => ({
			ch: options.selection ? 3 : 2,
			line: 1,
		}),
		getLine: (line: number) => content.split("\n")[line] ?? "",
		getSelection: () => options.selection ?? "selected",
		getValue: () => content,
		listSelections: () => [
			{
				anchor: { ch: 1, line: 1 },
				head: { ch: 3, line: 1 },
			},
		],
		posToOffset: (position: { ch: number; line: number }) =>
			position.line === 1 ? 6 + position.ch : position.ch,
		replaceRange: () => {},
		replaceSelection: () => {},
		scrollIntoView: () => {
			scrollCount++;
		},
		setLine: (line: number, value: string) => {
			const lines = content.split("\n");
			lines[line] = value;
			content = lines.join("\n");
		},
		setSelection: () => {},
		transaction: () => {
			transactionCount++;
		},
	};

	const handleFor = (file: TFile): ActiveEditorHandle => {
		const capturedMode = mode;
		const capturedPath = file.path;
		return {
			editor,
			file,
			isCurrent: () =>
				current &&
				activeFile === file &&
				file.path === capturedPath &&
				mode === capturedMode,
			mode: capturedMode,
			readInlineTitleSelection: () => inlineTitleSelection,
			restoreInlineTitleSelection: (saved) => {
				if (restoreFailure) throw restoreFailure;
				restoredInlineTitleSelection = saved;
			},
		};
	};

	const activeAccess = ActiveEditorAccess.of({
		getActiveEditor: Effect.suspend(() => {
			observationCount++;
			return observationFailure
				? Effect.fail(observationFailure)
				: Effect.succeed(
						exposeMissingFile
							? { ...handleFor(targetFile), file: null }
							: activeFile
								? handleFor(activeFile)
								: null,
					);
		}),
		openFile: (file) =>
			Effect.sync(() => {
				activeFile = file;
			}),
		waitForActiveEditor: ({ expectedInlineTitleText, path }) => {
			const attempt = Effect.suspend(() => {
				readinessCount++;
				lastExpectedInlineTitleText = expectedInlineTitleText;
				if (readinessFailure) return Effect.fail(readinessFailure);
				const file = files.get(path);
				return file &&
					(expectedInlineTitleText === undefined ||
						file.basename === expectedInlineTitleText)
					? Effect.succeed(handleFor(file))
					: Effect.fail(
							new VamActiveEditorError({
								cause: new Error("not ready"),
								operation: "waitForActiveEditor",
								path,
								reason: "ReadinessTimeout",
							}),
						);
			});
			return readinessDelayMs > 0
				? Effect.sleep(readinessDelayMs).pipe(Effect.andThen(attempt))
				: attempt;
		},
	});

	const vault = VaultIo.of({
		create: () => Effect.die("not used"),
		createFolder: () => Effect.die("not used"),
		getAbstractFileByPath: (path) =>
			Effect.sync(() => {
				const file = files.get(path) ?? null;
				afterVaultLookup?.();
				afterVaultLookup = null;
				return file;
			}),
		getMarkdownFiles: Effect.sync(() => [...files.values()]),
		modify: (_file, value) =>
			Effect.sync(() => {
				content = value;
			}),
		read: vaultRead,
		rename: (file, toPath) =>
			Effect.sync(() => {
				if (!(file instanceof TFile)) {
					throw new Error("Expected TFile");
				}
				files.delete(file.path);
				file.path = toPath;
				const filename = toPath.split("/").at(-1) ?? toPath;
				file.extension = filename.split(".").at(-1) ?? "";
				file.basename = filename.slice(0, -(file.extension.length + 1));
				files.set(toPath, file);
			}),
		resolveLinkpathDest: () => Effect.die("not used"),
		trash: (file) =>
			Effect.sync(() => {
				files.delete(file.path);
			}),
	});

	const layer = Layer.merge(
		Layer.succeed(ActiveEditorAccess, activeAccess),
		Layer.succeed(VaultIo, vault),
	);
	const access = new MarkdownFileAccess(
		new ActiveFileService(),
		new TFileHelper(),
	);
	const run = <A, E>(
		effect: Effect.Effect<A, E, ActiveEditorAccess | VaultIo>,
	) => Effect.runPromise(effect.pipe(Effect.provide(layer)));

	return {
		access,
		addVaultFile: (file: TFile, fileContent: string) => {
			files.set(file.path, file);
			vaultContents.set(file.path, fileContent);
		},
		getContent: () => content,
		getLastExpectedInlineTitleText: () => lastExpectedInlineTitleText,
		getObservationCount: () => observationCount,
		getReadinessCount: () => readinessCount,
		getRestoredInlineTitleSelection: () => restoredInlineTitleSelection,
		getScrollCount: () => scrollCount,
		getTransactionCount: () => transactionCount,
		otherFile,
		run,
		setActiveFile: (file: TFile | null) => {
			activeFile = file;
		},
		setAfterVaultLookup: (callback: () => void) => {
			afterVaultLookup = callback;
		},
		setContent: (value: string) => {
			content = value;
		},
		setCurrent: (value: boolean) => {
			current = value;
		},
		setExposeMissingFile: (value: boolean) => {
			exposeMissingFile = value;
		},
		setInlineTitleSelection: (value: SavedInlineTitleSelection | null) => {
			inlineTitleSelection = value;
		},
		setMode: (value: string) => {
			mode = value;
		},
		setObservationFailure: (error: VamActiveEditorError | null) => {
			observationFailure = error;
		},
		setReadinessDelay: (milliseconds: number) => {
			readinessDelayMs = milliseconds;
		},
		setReadinessFailure: (error: VamActiveEditorError | null) => {
			readinessFailure = error;
		},
		setRestoreFailure: (error: Error | null) => {
			restoreFailure = error;
		},
		setVaultIdentity: (path: string, file: TFile) => {
			files.set(path, file);
		},
		targetFile,
		vaultRead,
	};
}

function activeError(
	reason: VamActiveEditorError["reason"],
	operation = "test",
) {
	return new VamActiveEditorError({
		cause: new Error(reason),
		operation,
		reason,
	});
}

function asActiveError(error: unknown): VamActiveEditorError {
	if (!(error instanceof VamActiveEditorError)) {
		throw new Error("Expected VamActiveEditorError", { cause: error });
	}
	return error;
}

describe("MarkdownFileAccess", () => {
	it("routes an active read through one coherent editor observation", async () => {
		const harness = makeHarness();

		const content = await harness.run(harness.access.readContent(target));

		expect(content).toBe("editor content");
		expect(harness.getObservationCount()).toBe(1);
		expect(harness.vaultRead).not.toHaveBeenCalled();
	});

	it("routes a different or absent active editor through the vault", async () => {
		const different = makeHarness({ activePath: "Library/other.md" });
		const absent = makeHarness({ activePath: null });

		expect(await different.run(different.access.readContent(target))).toBe(
			"vault content",
		);
		expect(await absent.run(absent.access.readContent(target))).toBe(
			"vault content",
		);
		expect(different.getObservationCount()).toBe(1);
		expect(absent.getObservationCount()).toBe(1);
	});

	it("does not fall back to the vault for stale or adapter-failed observations", async () => {
		const stale = makeHarness();
		stale.setVaultIdentity("Library/note.md", makeFile("Library/note.md"));
		const adapter = makeHarness();
		adapter.setObservationFailure(activeError("AdapterFailure"));

		const staleFailure = await stale.run(
			Effect.flip(stale.access.readContent(target)),
		);
		const adapterFailure = await adapter.run(
			Effect.flip(adapter.access.readContent(target)),
		);

		expect(staleFailure).toBeInstanceOf(VamActiveEditorError);
		expect(asActiveError(staleFailure).reason).toBe("StaleFile");
		expect(asActiveError(adapterFailure).reason).toBe("AdapterFailure");
		expect(stale.vaultRead).not.toHaveBeenCalled();
		expect(adapter.vaultRead).not.toHaveBeenCalled();
	});

	it("reports preview mode before reading source-editor values", async () => {
		const harness = makeHarness({ mode: "preview" });

		const failure = await harness.run(
			Effect.flip(harness.access.readContent(target)),
		);

		expect(failure).toBeInstanceOf(VamActiveEditorError);
		expect(asActiveError(failure).reason).toBe("WrongMode");
		expect(await harness.run(harness.access.activeMdPath())).toEqual(
			target,
		);
	});

	it("suppresses only explicit absence in optional active-editor reads", async () => {
		const absent = makeHarness({ activePath: null });
		const missing = makeHarness();
		missing.setExposeMissingFile(true);

		expect(await absent.run(absent.access.activeContext())).toBeNull();
		const failure = await missing.run(
			Effect.flip(missing.access.activeContext()),
		);
		expect(asActiveError(failure).reason).toBe("MissingFile");
	});

	it("traces operation, path, and typed failure outcome", async () => {
		const harness = makeHarness({ mode: "preview" });
		const spans: Tracer.NativeSpan[] = [];
		const tracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		});

		await harness.run(
			Effect.result(harness.access.readContent(target)).pipe(
				Effect.withTracer(tracer),
			),
		);

		const span = spans.find(
			(candidate) => candidate.name === "vam.markdown.read",
		);
		expect(span?.attributes.get("operation")).toBe("read");
		expect(span?.attributes.get("path")).toBe("Library/note.md");
		expect(span?.attributes.get("error.tag")).toBe("VamActiveEditorError");
		expect(span?.attributes.get("error.reason")).toBe("WrongMode");
		expect(span?.attributes.get("error.path")).toBe("Library/note.md");
	});

	it("derives path, content, selection, and offsets from one snapshot", async () => {
		const harness = makeHarness({ selection: "sel" });
		harness.setContent("first\nsecond line\nthird");

		const context = await harness.run(harness.access.activeContext());

		expect(context).not.toBeNull();
		expect(context?.content).toBe("first\nsecond line\nthird");
		expect(context?.currentLine).toBe("second line");
		expect(context?.cursor).toEqual({ ch: 3, line: 1 });
		expect(context?.splitPath).toEqual(target);
		expect(context?.selection).toEqual({
			selectionStartInBlock: 3,
			splitPathToFileWithSelection: target,
			surroundingRawBlock: "second line",
			text: "sel",
		});
		expect(harness.getObservationCount()).toBe(1);
	});

	it("rejects a snapshot when focus changes during validation", async () => {
		const harness = makeHarness();
		const original = harness.targetFile;
		harness.setVaultIdentity(original.path, original);
		harness.setAfterVaultLookup(() => {
			harness.setActiveFile(harness.otherFile);
		});

		const failure = await harness.run(
			Effect.flip(harness.access.readContent(target)),
		);

		expect(asActiveError(failure).reason).toBe("IdentityMismatch");
		expect(harness.getObservationCount()).toBe(1);
	});

	it("rejects non-source routing when focus changes during snapshot validation", async () => {
		const harness = makeHarness({ activePath: "Library/other.md" });
		harness.setAfterVaultLookup(() => {
			harness.setActiveFile(harness.targetFile);
		});

		const failure = await harness.run(
			Effect.flip(harness.access.isActive(target)),
		);

		expect(asActiveError(failure).reason).toBe("IdentityMismatch");
		expect(harness.getObservationCount()).toBe(1);
	});

	it("rejects a snapshot when the captured file path changes during validation", async () => {
		const harness = makeHarness();
		harness.setAfterVaultLookup(() => {
			harness.targetFile.path = "Library/moved.md";
		});

		const failure = await harness.run(
			Effect.flip(harness.access.readContent(target)),
		);

		expect(asActiveError(failure).reason).toBe("IdentityMismatch");
		expect(harness.getObservationCount()).toBe(1);
	});

	it("rejects an async transform when editor identity or content changes", async () => {
		const identity = makeHarness();
		const content = makeHarness();
		const mode = makeHarness();

		const identityFailure = await identity.run(
			Effect.flip(
				identity.access.processContent({
					splitPath: target,
					transform: async (value) => {
						identity.setCurrent(false);
						return `${value}!`;
					},
				}),
			),
		);
		const contentFailure = await content.run(
			Effect.flip(
				content.access.processContent({
					splitPath: target,
					transform: async (value) => {
						content.setContent("user edit");
						return `${value}!`;
					},
				}),
			),
		);
		const modeFailure = await mode.run(
			Effect.flip(
				mode.access.processContent({
					splitPath: target,
					transform: async (value) => {
						mode.setMode("preview");
						return `${value}!`;
					},
				}),
			),
		);

		expect(asActiveError(identityFailure).reason).toBe("IdentityMismatch");
		expect(asActiveError(contentFailure).reason).toBe("IdentityMismatch");
		expect(asActiveError(modeFailure).reason).toBe("IdentityMismatch");
		expect(identity.getTransactionCount()).toBe(0);
		expect(content.getTransactionCount()).toBe(0);
		expect(mode.getTransactionCount()).toBe(0);
	});

	it("mutates an expected active line and rejects stale line content", async () => {
		const success = makeHarness();
		success.setContent("first\nsecond\nthird");
		const stale = makeHarness();
		stale.setContent("first\nchanged\nthird");

		await success.run(
			success.access.replaceOpenedLine({
				after: "second ^1",
				before: "second",
				line: 1,
				splitPath: target,
			}),
		);
		const failure = await stale.run(
			Effect.flip(
				stale.access.replaceOpenedLine({
					after: "second ^1",
					before: "second",
					line: 1,
					splitPath: target,
				}),
			),
		);

		expect(success.getContent()).toBe("first\nsecond ^1\nthird");
		expect(asActiveError(failure).reason).toBe("IdentityMismatch");
		expect(stale.getContent()).toBe("first\nchanged\nthird");
	});

	it("rejects a line mutation when the active editor is a different file", async () => {
		const harness = makeHarness({ activePath: "Library/other.md" });
		harness.setContent("first\nsecond\nthird");

		const failure = await harness.run(
			Effect.flip(
				harness.access.replaceOpenedLine({
					after: "second ^1",
					before: "second",
					line: 1,
					splitPath: target,
				}),
			),
		);

		expect(asActiveError(failure).reason).toBe("IdentityMismatch");
		expect(harness.getContent()).toBe("first\nsecond\nthird");
	});

	it("restores inline-title selection after observable rename readiness", async () => {
		const harness = makeHarness();

		const renamed = await harness.run(
			harness.access.renameFile({ from: target, to: renamedTarget }),
		);

		expect(renamed.path).toBe("Library/renamed.md");
		expect(harness.getReadinessCount()).toBe(1);
		expect(harness.getLastExpectedInlineTitleText()).toBe("renamed");
		expect(harness.getRestoredInlineTitleSelection()).toEqual({
			end: 4,
			start: 1,
			text: "note",
		});
	});

	it("waits for the actual indexed destination after a rename collision", async () => {
		const harness = makeHarness();
		harness.addVaultFile(
			makeFile("Library/renamed.md"),
			"different existing content",
		);

		const renamed = await harness.run(
			harness.access.renameFile({ from: target, to: renamedTarget }),
		);

		expect(renamed.path).toBe("Library/1_renamed.md");
		expect(harness.getLastExpectedInlineTitleText()).toBe("1_renamed");
		expect(harness.getRestoredInlineTitleSelection()).toEqual({
			end: 4,
			start: 1,
			text: "note",
		});
	});

	it("does not restore selection when collision handling returns another file", async () => {
		const harness = makeHarness();
		harness.addVaultFile(makeFile("Library/renamed.md"), "vault content");

		const renamed = await harness.run(
			harness.access.renameFile({ from: target, to: renamedTarget }),
		);

		expect(renamed.path).toBe("Library/renamed.md");
		expect(renamed).not.toBe(harness.targetFile);
		expect(harness.getReadinessCount()).toBe(0);
		expect(harness.getRestoredInlineTitleSelection()).toBeNull();
	});

	it("does not wait for title readiness when the renamed file is not active", async () => {
		const harness = makeHarness({ activePath: "Library/other.md" });

		await harness.run(
			harness.access.renameFile({ from: target, to: renamedTarget }),
		);

		expect(harness.getReadinessCount()).toBe(0);
		expect(harness.getRestoredInlineTitleSelection()).toBeNull();
	});

	it("does not wait when the active inline title has no saved selection", async () => {
		const harness = makeHarness();
		harness.setInlineTitleSelection(null);

		await harness.run(
			harness.access.renameFile({ from: target, to: renamedTarget }),
		);

		expect(harness.getReadinessCount()).toBe(0);
	});

	it("surfaces DOM restoration failure after the vault rename completes", async () => {
		const harness = makeHarness();
		harness.setRestoreFailure(new Error("DOM detached"));

		const failure = await harness.run(
			Effect.flip(
				harness.access.renameFile({ from: target, to: renamedTarget }),
			),
		);
		const typedFailure = asActiveError(failure);
		expect(typedFailure.reason).toBe("DomFailure");
		expect(typedFailure.stateChanged).toBe(true);
		expect(harness.targetFile.path).toBe("Library/renamed.md");
	});

	it("surfaces a typed readiness timeout after the vault rename completes", async () => {
		const harness = makeHarness();
		harness.setReadinessFailure(
			activeError("ReadinessTimeout", "waitForActiveEditor"),
		);

		const failure = await harness.run(
			Effect.flip(
				harness.access.renameFile({
					from: target,
					to: renamedTarget,
				}),
			),
		);

		const typedFailure = asActiveError(failure);
		expect(typedFailure.reason).toBe("ReadinessTimeout");
		expect(typedFailure.operation).toBe("renameFile.restoreSelection");
		expect(typedFailure.stateChanged).toBe(true);
		expect(harness.targetFile.path).toBe("Library/renamed.md");
	});

	it("finishes bounded selection restoration when interrupted after rename", async () => {
		const harness = makeHarness();
		harness.setReadinessDelay(20);

		await harness.run(
			Effect.gen(function* () {
				const fiber = yield* harness.access
					.renameFile({
						from: target,
						to: renamedTarget,
					})
					.pipe(Effect.forkChild);
				while (harness.targetFile.path !== "Library/renamed.md") {
					yield* Effect.yieldNow;
				}
				yield* Fiber.interrupt(fiber);
			}),
		);

		expect(harness.getRestoredInlineTitleSelection()).toEqual({
			end: 4,
			start: 1,
			text: "note",
		});
		expect(harness.targetFile.path).toBe("Library/renamed.md");
	});
});
