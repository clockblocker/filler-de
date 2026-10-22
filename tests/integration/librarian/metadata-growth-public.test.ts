/**
 * Regression for #107: empty Scrolls gained blank lines on every plugin
 * load. Each Librarian startup, and each recovery after a failed runtime
 * dispatch (it re-runs the startup reconciliation), applies the backlink
 * pass to every Scroll; each pass used to add two lines.
 */
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	SplitPathKind,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { withScanAndSubscribe } from "../../support/librarian-vam";
import { actionError, failedActions } from "../../support/vam-dispatch";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

const OPEN = '<section id="textfresser_meta_keep_me_invisible">';
const PADDING = "\n".repeat(20);
const LINK = "[[__-C1-P2|← C1]]";
const SECTION = `${OPEN}\n{"status":"NotStarted"}\n</section>\n`;

const scrollPath = (basename: string): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts: ["Library", "P2", "C1"],
});
const keyOf = (path: SplitPathToMdFile) =>
	[...path.pathParts, path.basename].join("/");

function makeVault(initial: Record<string, string>) {
	const files = new Map<string, string>();
	const paths = Object.keys(initial).map(scrollPath);
	for (const path of paths) files.set(keyOf(path), initial[path.basename] ?? "");
	let failNextRuntimeDispatch = false;
	let emit: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;

	const apply = async (action: VaultAction) => {
		if (action.kind === VaultActionKind.UpsertMdFile) {
			const key = keyOf(action.payload.splitPath);
			const content = action.payload.content;
			if (content !== null && content !== undefined) files.set(key, content);
			else if (!files.has(key)) files.set(key, "");
		}
		if (
			action.kind === VaultActionKind.ProcessMdFile &&
			"transform" in action.payload
		) {
			const key = keyOf(action.payload.splitPath);
			files.set(key, await action.payload.transform(files.get(key) ?? ""));
		}
	};

	const vam = withScanAndSubscribe({
		cd: () => Effect.void,
		dispatch: (actions) => {
			const [first] = actions;
			if (failNextRuntimeDispatch && first) {
				failNextRuntimeDispatch = false;
				return Effect.fail(
					failedActions([actionError(first, new Error("injected"))]),
				);
			}
			return Effect.promise(async () => {
				for (const action of actions) await apply(action);
			});
		},
		getActiveEditorContext: () => Effect.succeed(null),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () => {
			const entries: VaultScanPath[] = paths.map((path) => ({
				...path,
				read: () => Effect.succeed(files.get(keyOf(path)) ?? ""),
			}));
			return Effect.succeed({
				counts: {
					folderCount: 3,
					markdownFileCount: entries.length,
					otherFileCount: 0,
				},
				diagnostics: [],
				entries,
				kind: "Complete",
			});
		},
		subscribeToBulk: (handler) =>
			Effect.sync(() => {
				emit = handler;
				return { close: Effect.void };
			}),
	});

	return {
		/** A runtime Bulk whose dispatch fails, so the Librarian recovers. */
		failRuntimeDispatch: async () => {
			failNextRuntimeDispatch = true;
			await Effect.runPromise(
				emit({
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
								...scrollPath("New-C1-P2"),
							},
						},
					],
					roots: [],
				}).pipe(Effect.orDie),
			);
		},
		/** One plugin load: a fresh Librarian runs its startup. */
		load: () => Effect.runPromise(new Librarian(vam).init()),
		read: (basename: string) => files.get(keyOf(scrollPath(basename))),
	};
}

let spy: ReturnType<typeof spyOn> | null = null;
afterEach(() => spy?.mockRestore());

describe("Scroll metadata does not grow across loads", () => {
	for (const hideMetadata of [true, false]) {
		it(`stays byte-stable over loads and recoveries (hideMetadata: ${hideMetadata})`, async () => {
			spy = setupGetParsedUserSettingsSpy({ hideMetadata });
			const vault = makeVault({
				"Bloated-C1-P2": `\n ${LINK} ${"\n".repeat(1696)}${SECTION}`,
				"Empty-C1-P2": `${PADDING}${SECTION}`,
				"Frontmatter-C1-P2": "---\nstatus: false\n---\n",
				"Text-C1-P2": `Es war einmal.\n${PADDING}${SECTION}`,
			});

			await vault.load();
			const afterFirstLoad = ["Bloated", "Empty", "Frontmatter", "Text"].map(
				(name) => vault.read(`${name}-C1-P2`),
			);
			await vault.load();
			await vault.failRuntimeDispatch();
			await vault.load();
			expect(
				["Bloated", "Empty", "Frontmatter", "Text"].map((name) =>
					vault.read(`${name}-C1-P2`),
				),
			).toEqual(afterFirstLoad);

			const canonical = `\n ${LINK}${PADDING}${SECTION}`;
			expect(vault.read("Empty-C1-P2")).toBe(canonical);
			expect(vault.read("Bloated-C1-P2")).toBe(canonical);
			expect(vault.read("Text-C1-P2")).toBe(
				`\n ${LINK} \n\nEs war einmal.${PADDING}${SECTION}`,
			);
			expect(vault.read("Frontmatter-C1-P2")).toBe(
				`---\nstatus: false\n---\n\n ${LINK} \n\n`,
			);
		});
	}
});
