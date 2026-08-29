import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type SplitPathToFolder,
	splitPathCodec,
	VamScanError,
	VamVaultIoError,
} from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Option, Tracer } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";

describe("VaultActionManager scan", () => {
	it("returns a complete empty scan for an empty root", async () => {
		const harness = makeScanHarness({ empty: true });
		const { dispose, manager } = createVaultActionManager(harness.app);

		const scan = await Effect.runPromise(manager.scan(scanRoot));

		expect(scan).toEqual({
			counts: {
				folderCount: 1,
				markdownFileCount: 0,
				otherFileCount: 0,
			},
			diagnostics: [],
			entries: [],
			kind: "Complete",
		});
		await Effect.runPromise(dispose);
	});

	it("keeps successful siblings and a path-owned nested diagnostic", async () => {
		const harness = makeScanHarness({ unreadableNestedFolder: true });
		const { dispose, manager } = createVaultActionManager(harness.app);

		const scan = await Effect.runPromise(manager.scan(scanRoot));

		expect(scan.kind).toBe("Partial");
		expect(scan.counts).toEqual({
			folderCount: 3,
			markdownFileCount: 2,
			otherFileCount: 1,
		});
		expect(scan.entries.map(splitPathCodec.format)).toEqual([
			"Library/Good/nested.md",
			"Library/asset.pdf",
			"Library/root.md",
		]);
		expect(scan.diagnostics).toHaveLength(1);
		expect(scan.diagnostics[0]).toBeInstanceOf(VamScanError);
		expect(scan.diagnostics[0]?.path).toBe("Library/Bad");
		expect(scan.diagnostics[0]?.operation).toBe("scanFolder");
		await Effect.runPromise(dispose);
	});

	it("returns no live Obsidian references and defers environment-free reads", async () => {
		const harness = makeScanHarness({
			failedReadPath: "Library/Good/nested.md",
		});
		const { dispose, manager } = createVaultActionManager(harness.app);
		const scan = await Effect.runPromise(manager.scan(scanRoot));

		expect(harness.readCount).toBe(0);
		for (const entry of scan.entries) {
			expect(entry).not.toBeInstanceOf(TFile);
			expect(entry).not.toBeInstanceOf(TFolder);
			expect("tRef" in entry).toBe(false);
		}

		const rootEntry = scan.entries.find(
			(entry) => entry.basename === "root",
		);
		expect(rootEntry?.kind).toBe("MdFile");
		if (rootEntry?.kind === "MdFile") {
			const read = rootEntry.read();
			expect(Effect.isEffect(read)).toBe(true);
			expect(harness.readCount).toBe(0);
			expect(await Effect.runPromise(read)).toBe(
				"content:Library/root.md",
			);
		}
		expect(harness.readCount).toBe(1);

		const failedEntry = scan.entries.find(
			(entry) => entry.basename === "nested",
		);
		expect(failedEntry?.kind).toBe("MdFile");
		if (failedEntry?.kind === "MdFile") {
			const exit = await Effect.runPromiseExit(failedEntry.read());
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Option.getOrUndefined(
					Cause.findErrorOption(exit.cause),
				);
				expect(failure).toBeInstanceOf(VamVaultIoError);
				if (failure instanceof VamVaultIoError) {
					expect(failure.path).toBe("Library/Good/nested.md");
				}
			}
		}

		await Effect.runPromise(dispose);
	});

	it("fails a missing root with a typed scan error", async () => {
		const harness = makeScanHarness({ missingRoot: true });
		const { dispose, manager } = createVaultActionManager(harness.app);

		const exit = await Effect.runPromiseExit(manager.scan(scanRoot));

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const failure = Option.getOrUndefined(
				Cause.findErrorOption(exit.cause),
			);
			expect(failure).toBeInstanceOf(VamScanError);
			if (failure instanceof VamScanError) {
				expect(failure.path).toBe("Library");
				expect(failure.operation).toBe("scanRoot");
			}
		}
		await Effect.runPromise(dispose);
	});

	it("emits one attributed high-level scan span", async () => {
		const harness = makeScanHarness({ unreadableNestedFolder: true });
		const { dispose, manager } = createVaultActionManager(harness.app);
		const spans: Tracer.NativeSpan[] = [];
		const tracer = Tracer.make({
			span(options) {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		});

		await Effect.runPromise(
			manager.scan(scanRoot).pipe(Effect.withTracer(tracer)),
		);

		const scanSpans = spans.filter(
			(span) => span.name === "vam.vault.scan",
		);
		expect(scanSpans).toHaveLength(1);
		const span = scanSpans[0];
		expect(span?.attributes.get("root")).toBe("Library");
		expect(span?.attributes.get("folder.count")).toBe(3);
		expect(span?.attributes.get("file.markdown.count")).toBe(2);
		expect(span?.attributes.get("file.other.count")).toBe(1);
		expect(span?.attributes.get("failure.count")).toBe(1);
		expect(span?.attributes.get("duration.ms")).toBeGreaterThanOrEqual(0);
		await Effect.runPromise(dispose);
	});
});

const scanRoot: SplitPathToFolder = {
	basename: "Library",
	kind: "Folder",
	pathParts: [],
};

function makeScanHarness(
	options: {
		readonly empty?: boolean;
		readonly failedReadPath?: string;
		readonly missingRoot?: boolean;
		readonly unreadableNestedFolder?: boolean;
	} = {},
) {
	let readCount = 0;
	const root = folder("Library");
	const good = folder("Library/Good");
	const bad = folder("Library/Bad");
	const rootMd = file("Library/root.md");
	const asset = file("Library/asset.pdf");
	const nestedMd = file("Library/Good/nested.md");
	good.children = [nestedMd];
	bad.children = [];
	root.children = options.empty ? [] : [rootMd, asset, good, bad];
	for (const child of root.children) child.parent = root;
	nestedMd.parent = good;

	const byPath = new Map<string, TAbstractFile>([
		[root.path, root],
		[good.path, good],
		[bad.path, bad],
		[rootMd.path, rootMd],
		[asset.path, asset],
		[nestedMd.path, nestedMd],
	]);
	const callbacks = new Map<string, (...args: never[]) => void>();
	const app = {
		fileManager: {
			renameFile: async () => {},
			trashFile: async () => {},
		},
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			create: async () => rootMd,
			createFolder: async () => root,
			getAbstractFileByPath: (path: string) => {
				if (options.missingRoot && path === root.path) return null;
				if (options.unreadableNestedFolder && path === bad.path) {
					return null;
				}
				return byPath.get(path) ?? null;
			},
			getMarkdownFiles: () => [rootMd, nestedMd],
			modify: async () => {},
			offref: () => {},
			on: (name: string, callback: (...args: never[]) => void) => {
				callbacks.set(name, callback);
				return { callback, name };
			},
			read: async (target: TFile) => {
				readCount += 1;
				if (target.path === options.failedReadPath) {
					throw new Error("unreadable markdown");
				}
				return `content:${target.path}`;
			},
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: () => [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	return {
		app,
		get readCount() {
			return readCount;
		},
	};
}

function folder(path: string): TFolder {
	const value = new TFolder();
	value.path = path;
	value.name = path.split("/").at(-1) ?? path;
	value.children = [];
	return value;
}

function file(path: string): TFile {
	const value = new TFile();
	value.path = path;
	const name = path.split("/").at(-1) ?? path;
	const extension = name.split(".").at(-1) ?? "";
	value.extension = extension;
	value.basename = extension ? name.slice(0, -(extension.length + 1)) : name;
	value.name = name;
	return value;
}
