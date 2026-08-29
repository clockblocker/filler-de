import { describe, expect, it, mock } from "bun:test";
import type { App, TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import type { BulkVaultEvent } from "../../src/impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { VaultObservation } from "../../src/impl/event-processing/vault-observation";

type VaultCallback = (...args: never[]) => void;

function makeHarness(shouldIgnore: (path: string) => boolean) {
	const callbacks = new Map<string, VaultCallback>();
	const removed: unknown[] = [];
	const vault = {
		offref: (ref: unknown) => removed.push(ref),
		on: (name: string, callback: VaultCallback) => {
			callbacks.set(name, callback);
			return { callback, name };
		},
	};
	const app = { vault } as unknown as App;
	const selfEvents = { shouldIgnore } as unknown as SelfEventTracker;
	const observation = new VaultObservation(app, selfEvents, {
		maxWindowMs: 100,
		quietWindowMs: 10,
	});
	return { callbacks, observation, removed };
}

function mdFile(path: string): TAbstractFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
	file.extension = "md";
	return file;
}

describe("VaultObservation", () => {
	it("attributes a callback once and exposes the complete Bulk Vault Event", async () => {
		const observedPaths: string[] = [];
		const { callbacks, observation } = makeHarness((path) => {
			observedPaths.push(path);
			return false;
		});
		const bulks: BulkVaultEvent[] = [];

		observation.start();
		observation.subscribe(async (bulk) => {
			bulks.push(bulk);
		});
		callbacks.get("create")?.(mdFile("Library/note.md") as never);
		observation.flushPending();
		await observation.whenIdle();

		expect(observedPaths).toEqual(["Library/note.md"]);
		expect(bulks).toHaveLength(1);
		expect(bulks[0]?.events.map((event) => event.kind)).toEqual([
			"FileCreated",
		]);
		expect(bulks[0]?.roots).toEqual([]);
	});

	it("classifies both rename paths once and filters a Self Event rename", async () => {
		const shouldIgnore = mock(() => true);
		const { callbacks, observation } = makeHarness(shouldIgnore);
		const handler = mock(async () => {});

		observation.subscribe(handler);
		observation.start();
		callbacks.get("rename")?.(
			mdFile("Library/new.md") as never,
			"Library/old.md" as never,
		);
		observation.flushPending();
		await observation.whenIdle();

		expect(shouldIgnore).toHaveBeenCalledTimes(2);
		expect(shouldIgnore).toHaveBeenNthCalledWith(1, "Library/new.md");
		expect(shouldIgnore).toHaveBeenNthCalledWith(2, "Library/old.md");
		expect(handler).not.toHaveBeenCalled();
	});

	it("owns listener startup and teardown", () => {
		const { callbacks, observation, removed } = makeHarness(() => false);

		observation.start();
		expect(callbacks.size).toBe(0);

		const teardown = observation.subscribe(async () => {});
		expect([...callbacks.keys()].sort()).toEqual([
			"create",
			"delete",
			"rename",
		]);

		teardown();
		expect(removed).toHaveLength(3);
	});
});
