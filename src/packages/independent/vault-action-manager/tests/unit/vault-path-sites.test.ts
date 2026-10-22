import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type SplitPathToMdFile,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { snapshotMatches } from "../../src/file-services/active-view/active-editor-snapshot";
import {
	type BulkMdModifyEvent,
	scopeMdModifyEvent,
} from "../../src/impl/event-processing/md-modify-event";
import { makeFacadeHarness } from "./helpers/facade-harness";

const NFC = "Mütter";
const NFD = "Mütter";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;

describe("scopeMdModifyEvent path identity", () => {
	const event: BulkMdModifyEvent = {
		debug: { endedAt: 2, startedAt: 1, trueCount: 2 },
		modifications: [`${NFC}/Hund.md`, "worter/Katze.md"].map((path) => ({
			origin: { kind: "External" } as const,
			splitPath: md(path),
			stat: { ctime: 0, mtime: 1, size: 1 },
		})),
	};

	it("scopes to a folder whatever its Unicode composition", () => {
		const scoped = scopeMdModifyEvent(event, {
			basename: NFD,
			kind: "Folder",
			pathParts: [],
		});
		expect(
			scoped?.modifications.map(({ splitPath }) =>
				splitPathCodec.format(splitPath),
			),
		).toEqual([`${NFC}/Hund.md`]);
	});

	it("stays case-sensitive", () => {
		expect(
			scopeMdModifyEvent(event, {
				basename: "Worter",
				kind: "Folder",
				pathParts: [],
			}),
		).toBeNull();
	});
});

describe("snapshotMatches path identity", () => {
	const snapshot = (path: string) =>
		({ path }) as Parameters<typeof snapshotMatches>[0];

	it("routes an NFD target to the editor showing its NFC file", () => {
		expect(
			snapshotMatches(
				snapshot(`Worter/${NFC}.md`),
				md(`Worter/${NFD}.md`),
			),
		).toBe(true);
	});

	it("stays case-sensitive", () => {
		expect(
			snapshotMatches(snapshot("Worter/note.md"), md("Worter/Note.md")),
		).toBe(false);
	});
});

describe("findByBasename folder scope", () => {
	it("finds notes anywhere when scoped to the vault root", async () => {
		const harness = makeFacadeHarness();
		const { dispose, manager } = createVaultActionManager(harness.app);
		const inRoot = await Effect.runPromise(
			manager.findByBasename("note", { folder: splitPathCodec.root }),
		);
		const inLibrary = await Effect.runPromise(
			manager.findByBasename("note", {
				folder: { basename: "Library", kind: "Folder", pathParts: [] },
			}),
		);
		const inSibling = await Effect.runPromise(
			manager.findByBasename("note", {
				folder: { basename: "Lib", kind: "Folder", pathParts: [] },
			}),
		);
		expect(inRoot.map(splitPathCodec.format)).toEqual(["Library/note.md"]);
		expect(inLibrary.map(splitPathCodec.format)).toEqual([
			"Library/note.md",
		]);
		expect(inSibling).toEqual([]);
		await Effect.runPromise(dispose);
	});
});
