import type { BulkVaultEvent } from "../../../../../../src/managers/obsidian/vault-action-manager";

export const bulkEvent: BulkVaultEvent = {
	debug: {
		collapsedCount: {
			creates: 3,
			deletes: 0,
			renames: 0,
		},
		endedAt: 1768368050053,
		reduced: {
			rootDeletes: 0,
			rootRenames: 0,
		},
		startedAt: 1768368049799,
		trueCount: {
			creates: 3,
			deletes: 0,
			renames: 0,
		},
	},
	events: [
		{
			kind: "FolderCreated",
			splitPath: {
				basename: "kid1 1",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
		},
		{
			kind: "FileCreated",
			splitPath: {
				basename: "ReName-kid1-mommy-parents",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
		},
		{
			kind: "FileCreated",
			splitPath: {
				basename: "__-kid1-mommy-parents",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
		},
	],
	roots: [],
} as const;
