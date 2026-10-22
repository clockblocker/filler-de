/**
 * Before a link-updating rename VAM reads who links to the renamed entry,
 * labels Obsidian's rewrites of those files `LinkUpdate` (`Predicted`) with
 * the rename's operation, and puts back a protected file the rewrite
 * touched. Rewrites it did not predict still reach the protected-path
 * watcher.
 */
import { describe, expect, it } from "bun:test";
import {
	type BulkMdModifyEvent,
	createVaultActionManager,
	type ProtectedPathModificationsEvent,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VaultAction,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { differsOnlyInLinks } from "../../src/impl/event-processing/link-updates";
import {
	makeObsidianVault,
	type ObsidianVaultLinkOptions,
} from "./helpers/obsidian-vault";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const EXEMPLAR = "Exemplar/Kohlekraftwerk/Kohlekraftwerk.md";
const KRAFTWERK = "Worter/Kraftwerk.md";
const MOVED = "Worter/k/Kraftwerk.md";

const renameMd = (from: string, to: string): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: { from: md(from), onCollision: "fail", to: md(to) },
});

type Observed = {
	readonly modified: string[];
	readonly protectedWriters: {
		readonly path: string;
		readonly renamed?: { readonly from: string; readonly to: string };
		readonly writer: string;
	}[];
};

const describeOrigin = (
	origin: BulkMdModifyEvent["modifications"][number]["origin"],
): string => {
	switch (origin.kind) {
		case "LinkUpdate":
			return `LinkUpdate ${origin.basis} ${origin.operationId}`;
		case "Vam":
			return `Vam ${origin.operationId}`;
		case "External":
			return "External";
	}
};

const describeModify = (event: BulkMdModifyEvent): string[] =>
	event.modifications.map(
		({ origin, splitPath }) =>
			`${splitPathCodec.format(splitPath)} (${describeOrigin(origin)})`,
	);

const describeProtected = (event: ProtectedPathModificationsEvent) =>
	event.modifications.map(({ renamed, splitPath, writer }) => ({
		path: splitPathCodec.format(splitPath),
		...(renamed === undefined ? {} : { renamed }),
		writer,
	}));

/**
 * Runs `act` against a VAM protecting `Exemplar`, over a vault holding
 * `initial` with the resolved links `links` (source to target), and answers
 * what the subscriptions heard once it settled.
 */
async function observe(
	initial: Record<string, string>,
	links: readonly (readonly [string, string])[],
	act: (manager: VaultActionManager) => Effect.Effect<void, unknown>,
	options: ObsidianVaultLinkOptions & {
		readonly unpredicted?: readonly string[];
		readonly vault?: (vault: ReturnType<typeof makeObsidianVault>) => void;
	} = {},
) {
	const vault = makeObsidianVault(initial, options);
	for (const [source, target] of links) vault.linkTo(source, target);
	for (const path of options.unpredicted ?? []) vault.unpredicted.add(path);
	options.vault?.(vault);
	const { dispose, manager, testing } = createVaultActionManager(vault.app, {
		protectedPaths: ["Exemplar"],
	});
	const observed: Observed = { modified: [], protectedWriters: [] };
	await Effect.runPromise(
		Effect.gen(function* () {
			yield* manager.startListening();
			yield* manager.subscribeToBulk(() => Effect.void);
			yield* manager.subscribeToMdModifications(
				splitPathCodec.root,
				(event) =>
					Effect.sync(() =>
						observed.modified.push(...describeModify(event)),
					),
				{ from: "all" },
			);
			yield* manager.subscribeToProtectedPathModifications((event) =>
				Effect.sync(() =>
					observed.protectedWriters.push(...describeProtected(event)),
				),
			);
			yield* act(manager);
			yield* testing.whenSettled();
		}).pipe(Effect.ensuring(Effect.ignore(dispose))),
	);
	return { observed, vault };
}

describe("link updates after a VAM rename", () => {
	it("labels the predicted rewrite of a file linking to the renamed file LinkUpdate, with the rename's operation", async () => {
		const { observed, vault } = await observe(
			{ "Library/Story.md": "[[Kraftwerk]]", [KRAFTWERK]: "# Kraftwerk" },
			[["Library/Story.md", KRAFTWERK]],
			(manager) =>
				manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
					caller: "dictionary",
					operationId: "heal-kraftwerk",
				}),
		);

		expect(vault.content("Library/Story.md")).toBe(
			"[[Worter/k/Kraftwerk]]",
		);
		expect(observed.modified).toEqual([
			"Library/Story.md (LinkUpdate Predicted heal-kraftwerk)",
		]);
		expect(observed.protectedWriters).toEqual([]);
	});

	it("predicts the rewrites of a folder rename from every descendant's backlinks, at their paths after the move", async () => {
		const { observed } = await observe(
			{
				"Library/Story.md": "[[a]]",
				"Worter/de/a.md": "# a",
				"Worter/de/sub/b.md": "[[a]]",
			},
			[
				["Library/Story.md", "Worter/de/a.md"],
				["Worter/de/sub/b.md", "Worter/de/a.md"],
			],
			(manager) =>
				manager.dispatch(
					[
						{
							kind: VaultActionKind.RenameFolder,
							payload: {
								from: folder("Worter/de"),
								onCollision: "fail",
								to: folder("Worter/deutsch"),
							},
						},
					],
					{ caller: "librarian", operationId: "heal-section" },
				),
		);

		expect(observed.modified.sort()).toEqual([
			"Library/Story.md (LinkUpdate Predicted heal-section)",
			"Worter/deutsch/sub/b.md (LinkUpdate Predicted heal-section)",
		]);
	});

	it("keeps the rename of a note a protected file links to, and puts the protected file back", async () => {
		const exemplar = "Strom aus [[Kraftwerk]].";
		let report: readonly string[] = [];
		const { observed, vault } = await observe(
			{
				[EXEMPLAR]: exemplar,
				"Library/Story.md": "[[Kraftwerk]]",
				[KRAFTWERK]: "# Kraftwerk",
			},
			[
				[EXEMPLAR, KRAFTWERK],
				["Library/Story.md", KRAFTWERK],
			],
			(manager) =>
				manager
					.dispatchWithReport([renameMd(KRAFTWERK, MOVED)], {
						caller: "dictionary",
						operationId: "heal-kraftwerk",
					})
					.pipe(
						Effect.tap((done) =>
							Effect.sync(() => {
								report = done.entries.map(
									({ action, status }) =>
										`${action.kind} ${status}`,
								);
							}),
						),
					),
		);

		expect(report).toEqual(["CreateFolder Done", "RenameMdFile Done"]);
		expect(vault.files()).toContain(MOVED);
		expect(vault.content(EXEMPLAR)).toBe(exemplar);
		expect(vault.content("Library/Story.md")).toBe(
			"[[Worter/k/Kraftwerk]]",
		);
		expect(observed.protectedWriters).toEqual([
			{
				path: EXEMPLAR,
				renamed: { from: KRAFTWERK, to: MOVED },
				writer: "RestoredAfterLinkUpdate",
			},
		]);
		expect(observed.modified).toContain(
			"Library/Story.md (LinkUpdate Predicted heal-kraftwerk)",
		);
	});

	it("never writes over a protected file that changed again before VAM could put it back", async () => {
		let vault: ReturnType<typeof makeObsidianVault> | undefined;
		const result = await observe(
			{ [EXEMPLAR]: "[[Kraftwerk]]", [KRAFTWERK]: "# Kraftwerk" },
			[[EXEMPLAR, KRAFTWERK]],
			(manager) =>
				manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
					caller: "dictionary",
					operationId: "heal-kraftwerk",
				}),
			{
				afterRewrite: () => vault?.editByHand(EXEMPLAR, "typed"),
				vault: (made) => {
					vault = made;
				},
			},
		);

		expect(result.vault.content(EXEMPLAR)).toBe("typed");
		expect(result.observed.protectedWriters).toEqual([
			{ path: EXEMPLAR, writer: "Unattributed" },
		]);
	});

	it("never puts back a predicted protected file that Obsidian left alone but someone edited during the rename", async () => {
		// The resolved links say the exemplar links to Kraftwerk, but no
		// link the move changes; the one modify callback is the user's.
		let vault: ReturnType<typeof makeObsidianVault> | undefined;
		const result = await observe(
			{ [EXEMPLAR]: "Strom aus Kohle.", [KRAFTWERK]: "# Kraftwerk" },
			[[EXEMPLAR, KRAFTWERK]],
			(manager) =>
				manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
					caller: "dictionary",
					operationId: "heal-kraftwerk",
				}),
			{
				afterRewrite: () =>
					vault?.editByHand(EXEMPLAR, "Strom aus Kohle, getippt."),
				vault: (made) => {
					vault = made;
				},
			},
		);

		expect(result.vault.content(EXEMPLAR)).toBe(
			"Strom aus Kohle, getippt.",
		);
		expect(result.observed.protectedWriters).toEqual([
			{ path: EXEMPLAR, writer: "VamRenameLinkUpdate" },
		]);
	});

	it("never puts back a rewritten protected file that another writer changed before its callback arrived", async () => {
		let vault: ReturnType<typeof makeObsidianVault> | undefined;
		const result = await observe(
			{ [EXEMPLAR]: "[[Kraftwerk]]", [KRAFTWERK]: "# Kraftwerk" },
			[[EXEMPLAR, KRAFTWERK]],
			(manager) =>
				manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
					caller: "dictionary",
					operationId: "heal-kraftwerk",
				}),
			{
				afterRewrite: () =>
					vault?.editUnheard(
						EXEMPLAR,
						`${vault.content(EXEMPLAR)} (synced)`,
					),
				vault: (made) => {
					vault = made;
				},
			},
		);

		expect(result.vault.content(EXEMPLAR)).toBe(
			"[[Worter/k/Kraftwerk]] (synced)",
		);
		expect(result.observed.protectedWriters).toEqual([
			{ path: EXEMPLAR, writer: "VamRenameLinkUpdate" },
		]);
	});

	it("reports a protected file as rewritten, not restored, when a later rename of the batch rewrote it and VAM left it", async () => {
		const KOHLE = "Worter/Kohle.md";
		let vault: ReturnType<typeof makeObsidianVault> | undefined;
		let rewrites = 0;
		const result = await observe(
			{
				[EXEMPLAR]: "[[Kraftwerk]] und [[Kohle]]",
				[KOHLE]: "# Kohle",
				[KRAFTWERK]: "# Kraftwerk",
			},
			[
				[EXEMPLAR, KRAFTWERK],
				[EXEMPLAR, KOHLE],
			],
			(manager) =>
				manager.dispatch(
					[
						renameMd(KRAFTWERK, MOVED),
						renameMd(KOHLE, "Worter/k/Kohle.md"),
					],
					{ caller: "dictionary", operationId: "heal-k" },
				),
			{
				afterRewrite: () => {
					rewrites += 1;
					if (rewrites === 2)
						vault?.editUnheard(
							EXEMPLAR,
							`${vault.content(EXEMPLAR)} (synced)`,
						);
				},
				vault: (made) => {
					vault = made;
				},
			},
		);

		expect(result.vault.content(EXEMPLAR)).toBe(
			"[[Kraftwerk]] und [[Worter/k/Kohle]] (synced)",
		);
		expect(result.observed.protectedWriters.at(-1)).toEqual({
			path: EXEMPLAR,
			writer: "VamRenameLinkUpdate",
		});
	});

	it("still reports a protected file Obsidian rewrote without a predicted link", async () => {
		const { observed, vault } = await observe(
			{ [EXEMPLAR]: "[[Kraftwerk]]", [KRAFTWERK]: "# Kraftwerk" },
			[],
			(manager) =>
				manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
					caller: "dictionary",
					operationId: "heal-kraftwerk",
				}),
			{ unpredicted: [EXEMPLAR] },
		);

		expect(vault.content(EXEMPLAR)).toBe("[[Worter/k/Kraftwerk]]");
		expect(observed.protectedWriters).toEqual([
			{ path: EXEMPLAR, writer: "Unattributed" },
		]);
	});

	it("with link updating set to ask, changes nothing when the user declines and puts the protected file back when the user agrees", async () => {
		const initial = {
			[EXEMPLAR]: "[[Kraftwerk]]",
			"Library/Story.md": "[[Kraftwerk]]",
			[KRAFTWERK]: "# Kraftwerk",
		};
		const links = [
			[EXEMPLAR, KRAFTWERK],
			["Library/Story.md", KRAFTWERK],
		] as const;
		const rename = (manager: VaultActionManager) =>
			manager.dispatch([renameMd(KRAFTWERK, MOVED)], {
				caller: "dictionary",
				operationId: "heal-kraftwerk",
			});

		const declined = await observe(initial, links, rename, {
			alwaysUpdateLinks: false,
			answer: "decline",
		});
		expect(declined.vault.files()).toContain(MOVED);
		expect(declined.vault.content(EXEMPLAR)).toBe("[[Kraftwerk]]");
		expect(declined.vault.content("Library/Story.md")).toBe(
			"[[Kraftwerk]]",
		);
		expect(declined.observed).toEqual({
			modified: [],
			protectedWriters: [],
		});

		const agreed = await observe(initial, links, rename, {
			alwaysUpdateLinks: false,
			answer: "update",
		});
		expect(agreed.vault.content(EXEMPLAR)).toBe("[[Kraftwerk]]");
		expect(agreed.observed.modified).toContain(
			"Library/Story.md (LinkUpdate Predicted heal-kraftwerk)",
		);
		expect(agreed.observed.protectedWriters).toEqual([
			{
				path: EXEMPLAR,
				renamed: { from: KRAFTWERK, to: MOVED },
				writer: "RestoredAfterLinkUpdate",
			},
		]);
	});
});

describe("differsOnlyInLinks", () => {
	it("accepts links rewritten in place, of every kind Obsidian rewrites", () => {
		expect(
			differsOnlyInLinks(
				'---\nsiehe: "[[Kraftwerk]]"\n---\n![[Kohle]] und [K](Kraftwerk.md "t") und [[Kraftwerk|Kw]]',
				'---\nsiehe: "[[Worter/k/Kraftwerk]]"\n---\n![[Worter/Kohle]] und [K](<Neu Ordner/Kraftwerk.md> "t") und [[Worter/k/Kraftwerk|Kw]]',
			),
		).toBe(true);
	});

	it("refuses any change outside a link, and a link added or removed", () => {
		expect(differsOnlyInLinks("[[a]] b", "[[x]] c")).toBe(false);
		expect(differsOnlyInLinks("[[a]] b", "[[a]] [[x]] b")).toBe(false);
		expect(differsOnlyInLinks("[[a]] b", " b")).toBe(false);
		expect(differsOnlyInLinks("[[a]]", "[[a]]\n")).toBe(false);
	});
});
