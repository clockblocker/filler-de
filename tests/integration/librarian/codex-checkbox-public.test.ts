import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	generateCodexContent,
	makeCodecRulesFromSettings,
	makeCodecs,
	type SectionNodeSegmentId,
} from "@textfresser/library-core";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import type { VaultScanPath } from "@textfresser/vault-action-manager";
import {
	type BulkVaultEvent,
	SplitPathKind,
	type SplitPathToFile,
	type SplitPathToMdFile,
	VamDispatchError,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function sectionChain(...names: string[]): SectionNodeSegmentId[] {
	return names.map(
		(name) => `${name}﹘Section﹘` as SectionNodeSegmentId,
	);
}

function scroll(
	pathParts: string[],
	basename: string,
): VaultScanPath {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
		read: () => Effect.succeed(""),
	};
}

function file(
	pathParts: string[],
	basename: string,
	extension: string,
): SplitPathToFile {
	return { basename, extension, kind: SplitPathKind.File, pathParts };
}

function createdScrollBulk(name: string): BulkVaultEvent {
	return {
		debug: {
			collapsedCount: { creates: 1, deletes: 0, renames: 0 },
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 1,
			trueCount: { creates: 1, deletes: 0, renames: 0 },
		},
		events: [
			{
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename: name,
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
			},
		],
		roots: [],
	};
}

function makeHarness(
	initialFiles: VaultScanPath[],
	bulkDuringSubscription?: BulkVaultEvent,
) {
	const dispatches: VaultAction[][] = [];
	let scannedFiles = initialFiles;
	let dispatchImpl: (
		actions: readonly VaultAction[],
	) => Effect.Effect<void, readonly VamDispatchError[]> = () => Effect.void;
	let emitBulk: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;
	const vam: LibrarianVam = {
		cd: () => Effect.void,
		dispatch: (actions: readonly VaultAction[]) =>
			Effect.sync(() => dispatches.push([...actions])).pipe(
				Effect.andThen(dispatchImpl(actions)),
			),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.succeed({
				counts: {
					folderCount: 1,
					markdownFileCount: scannedFiles.filter(
						(path) => path.kind === SplitPathKind.MdFile,
					).length,
					otherFileCount: scannedFiles.filter(
						(path) => path.kind === SplitPathKind.File,
					).length,
				},
				diagnostics: [],
				entries: scannedFiles,
				kind: "Complete",
			}),
		subscribeToBulk: (handler) =>
			Effect.gen(function* () {
				emitBulk = handler;
				if (bulkDuringSubscription) {
					yield* handler(bulkDuringSubscription).pipe(Effect.orDie);
				}
				return { close: Effect.void };
			}),
	};

	return {
		dispatches,
		emitBulk: (bulk: BulkVaultEvent) => emitBulk(bulk),
		librarian: new Librarian(vam),
		setDispatch: (
			implementation: (
				actions: readonly VaultAction[],
			) => Effect.Effect<void, readonly VamDispatchError[]>,
		) => {
			dispatchImpl = implementation;
		},
		setScanFiles: (files: VaultScanPath[]) => {
			scannedFiles = files;
		},
	};
}

function hasProcessActionFor(
	dispatches: readonly (readonly VaultAction[])[],
	expected: SplitPathToMdFile,
): boolean {
	return dispatches.flat().some(
		(action) =>
			action.kind === VaultActionKind.ProcessMdFile &&
			action.payload.splitPath.basename === expected.basename &&
			action.payload.splitPath.pathParts.join("/") ===
				expected.pathParts.join("/"),
	);
}

function codexContent(
	librarian: Librarian,
	chain: SectionNodeSegmentId[],
): string {
	const healer = librarian.getHealer();
	expect(healer).not.toBeNull();
	if (!healer) return "";
	const section = healer.findSection(chain);
	expect(section).toBeDefined();
	if (!section) return "";
	const codecs = makeCodecs(
		makeCodecRulesFromSettings(defaultSettingsForUnitTests),
	);
	return generateCodexContent(section, chain, codecs);
}

describe("Librarian checkbox-click public seam", () => {
	it("reconciles startup before vault events delivered by subscription", async () => {
		const observedDuringSubscription: BulkVaultEvent = {
			debug: {
				collapsedCount: { creates: 1, deletes: 0, renames: 0 },
				endedAt: 2,
				reduced: { rootDeletes: 0, rootRenames: 0 },
				startedAt: 1,
				trueCount: { creates: 1, deletes: 0, renames: 0 },
			},
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: {
						basename: "DuringStartup",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library"],
					},
				},
			],
			roots: [],
		};
		const { librarian } = makeHarness([], observedDuringSubscription);

		await Effect.runPromise(librarian.init());

		expect(
			librarian
				.getRecentReconciliationOutcomes()
				.map((outcome) => outcome.source),
		).toEqual(["Startup", "ObservedBulk"]);
		expect(
			librarian.findMatchingLeavesByCoreName("DuringStartup"),
		).toHaveLength(1);
		await Effect.runPromise(librarian.unsubscribe());
	});

	it("routes observed Bulk Vault Events through reconciliation", async () => {
		const { emitBulk, librarian } = makeHarness([]);
		await Effect.runPromise(librarian.init());

		await Effect.runPromise(
			emitBulk({
				debug: {
					collapsedCount: { creates: 1, deletes: 0, renames: 0 },
					endedAt: 2,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 1,
					trueCount: { creates: 1, deletes: 0, renames: 0 },
				},
				events: [
					{
						kind: VaultEventKind.FileCreated,
						splitPath: {
							basename: "Observed",
							extension: "md",
							kind: SplitPathKind.MdFile,
							pathParts: ["Library"],
						},
					},
				],
				roots: [],
			}),
		);

		expect(librarian._debugLastReconciliationOutcome?.source).toBe(
			"ObservedBulk",
		);
		expect(librarian.findMatchingLeavesByCoreName("Observed")).toHaveLength(
			1,
		);
		await Effect.runPromise(librarian.unsubscribe());
	});

	it("keeps later queued work behind partial-dispatch recovery", async () => {
		const existing = scroll(["Library"], "Existing");
		const first = scroll(["Library"], "First");
		const second = scroll(["Library"], "Second");
		const { dispatches, emitBulk, librarian, setDispatch, setScanFiles } =
			makeHarness([existing]);
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;
		setScanFiles([existing, first]);

		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("first dispatch was only partially applied"),
				operation: "executeAction",
			}),
		] as const;
		let releaseFirstDispatch: () => void = () => undefined;
		const firstDispatchGate = new Promise<void>((resolve) => {
			releaseFirstDispatch = resolve;
		});
		let reportFirstDispatchStarted: () => void = () => undefined;
		const firstDispatchStarted = new Promise<void>((resolve) => {
			reportFirstDispatchStarted = resolve;
		});
		let shouldFail = true;
		setDispatch(() => {
			if (!shouldFail) return Effect.void;
			shouldFail = false;
			reportFirstDispatchStarted();
			return Effect.promise(() => firstDispatchGate).pipe(
				Effect.andThen(Effect.fail(partialFailures)),
			);
		});

		const firstBulk = Effect.runPromise(emitBulk(createdScrollBulk("First")));
		await firstDispatchStarted;
		const secondBulk = Effect.runPromise(
			emitBulk(createdScrollBulk("Second")),
		);
		setScanFiles([existing, first, second]);
		releaseFirstDispatch();
		await Promise.all([firstBulk, secondBulk]);

		expect(
			librarian.getRecentReconciliationOutcomes().map((outcome) => ({
				recovery: outcome.recovery.kind,
				source: outcome.source,
				status: outcome.status,
			})),
		).toEqual([
			{ recovery: "NotNeeded", source: "Startup", status: "Success" },
			{
				recovery: "Resynchronized",
				source: "ObservedBulk",
				status: "PartialFailure",
			},
			{
				recovery: "NotNeeded",
				source: "ObservedBulk",
				status: "NoOp",
			},
		]);
		expect(librarian.findMatchingLeavesByCoreName("Existing")).toHaveLength(
			1,
		);
		expect(librarian.findMatchingLeavesByCoreName("First")).toHaveLength(1);
		expect(librarian.findMatchingLeavesByCoreName("Second")).toHaveLength(1);
		expect(dispatches).toHaveLength(2);

		await Effect.runPromise(librarian.unsubscribe());
	});

	it("marks one Scroll Done and updates its ancestor Section status", async () => {
		const fishPath = ["Library", "Recipe", "Pie", "Fish"];
		const { dispatches, librarian } = makeHarness([
			scroll(fishPath, "Steps-Fish-Pie-Recipe"),
			file(fishPath, "Result_picture-Fish-Pie-Recipe", "jpg"),
		]);
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;

		await Effect.runPromise(
			librarian.handleCodexCheckboxClick({
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[Steps-Fish-Pie-Recipe|Steps]]",
				sourcePath: "Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
			}),
		);

		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie", "Fish"),
			),
		).toContain("- [x] [[Steps-Fish-Pie-Recipe|Steps]]");
		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie"),
			),
		).toContain("- [x] [[__-Fish-Pie-Recipe|Fish]]");
		expect(
			hasProcessActionFor(dispatches, {
				basename: "Steps-Fish-Pie-Recipe",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: fishPath,
			}),
		).toBe(true);
		expect(librarian._debugLastReconciliationOutcome?.source).toBe(
			"CodexClick",
		);
		expect(librarian._debugLastReconciliationOutcome?.derived.backlink).toBe(
			0,
		);

		await Effect.runPromise(librarian.unsubscribe());
	});

	it("marks every descendant Scroll Done when a Section is checked", async () => {
		const berryPath = ["Library", "Recipe", "Pie", "Berry"];
		const scrollNames = ["Ingredients", "Steps", "Renamed"];
		const { dispatches, librarian } = makeHarness(
			scrollNames.map((name) =>
				scroll(berryPath, `${name}-Berry-Pie-Recipe`),
			),
		);
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;

		await Effect.runPromise(
			librarian.handleCodexCheckboxClick({
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[__-Berry-Pie-Recipe|Berry]]",
				sourcePath: "Library/Recipe/Pie/__-Pie-Recipe.md",
			}),
		);

		const berryCodex = codexContent(
			librarian,
			sectionChain("Library", "Recipe", "Pie", "Berry"),
		);
		for (const name of scrollNames) {
			expect(berryCodex).toContain(
				`- [x] [[${name}-Berry-Pie-Recipe|${name}]]`,
			);
			expect(
				hasProcessActionFor(dispatches, {
					basename: `${name}-Berry-Pie-Recipe`,
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: berryPath,
				}),
			).toBe(true);
		}
		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie"),
			),
		).toContain("- [x] [[__-Berry-Pie-Recipe|Berry]]");
		expect(librarian._debugLastReconciliationOutcome?.source).toBe(
			"CodexClick",
		);
		expect(librarian._debugLastReconciliationOutcome?.status).toBe(
			"Success",
		);

		await Effect.runPromise(librarian.unsubscribe());
	});
});
