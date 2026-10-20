import { describe, expect, it } from "bun:test";
import {
	type BulkVaultEvent,
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	type VaultEvent,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { dropScannedEvents } from "../../../src/commanders/librarian/init/drop-scanned-events";

function md(basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "Soup"],
	};
}

function bulk(events: VaultEvent[]): BulkVaultEvent {
	const count = { creates: 0, deletes: 0, renames: 0 };
	return {
		debug: {
			collapsedCount: count,
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 1,
			trueCount: count,
		},
		events,
		roots: events.flatMap((event) =>
			event.kind === VaultEventKind.FileRenamed ||
			event.kind === VaultEventKind.FileDeleted
				? [event]
				: [],
		),
	};
}

const created = (basename: string): VaultEvent => ({
	kind: VaultEventKind.FileCreated,
	splitPath: md(basename),
});
const renamed = (from: string, to: string): VaultEvent => ({
	from: md(from),
	kind: VaultEventKind.FileRenamed,
	to: md(to),
});
const deleted = (basename: string): VaultEvent => ({
	kind: VaultEventKind.FileDeleted,
	splitPath: md(basename),
});

describe("dropScannedEvents", () => {
	it("drops creates of scanned paths and renames into them from unscanned ones", () => {
		const [result] = dropScannedEvents(
			[bulk([created("a"), renamed("old", "b"), created("new")])],
			[md("a"), md("b")],
		);

		expect(result?.events).toEqual([created("new")]);
		expect(result?.roots).toEqual([]);
	});

	it("keeps later events about files created, renamed or deleted after the scan", () => {
		const bulks = [
			bulk([created("fresh")]),
			bulk([renamed("fresh", "late")]),
			bulk([deleted("a")]),
			bulk([created("a")]),
			bulk([renamed("b", "c")]),
			bulk([renamed("c", "b")]),
		];

		expect(dropScannedEvents(bulks, [md("a"), md("b")])).toEqual(bulks);
	});
});
