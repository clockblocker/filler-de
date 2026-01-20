import type { BulkVaultEvent } from "../../../../../../src/managers/obsidian/vault-action-manager";
import { MD } from "../../../../../../src/managers/obsidian/vault-action-manager/types/literals";

export const bulkEvent: BulkVaultEvent = {
	debug: {
		collapsedCount: {
			creates: 0,
			deletes: 0,
			renames: 4,
		},
		endedAt: 1768368174694,
		reduced: {
			rootDeletes: 0,
			rootRenames: 1,
		},
		startedAt: 1768368174440,
		trueCount: {
			creates: 0,
			deletes: 0,
			renames: 4,
		},
	},
	events: [
		{
			from: {
				basename: "__-kid1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
			kind: "FileRenamed",
			to: {
				basename: "__-kid1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "daddy", "kid3"],
			},
		},
		{
			from: {
				basename: "ReName-kid3-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
			kind: "FileRenamed",
			to: {
				basename: "ReName-kid3-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "daddy", "kid3"],
			},
		},
		{
			from: {
				basename: "__-kid3-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
			kind: "FileRenamed",
			to: {
				basename: "__-kid3-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "daddy", "kid3"],
			},
		},
		{
			from: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
			kind: "FolderRenamed",
			to: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "daddy"],
			},
		},
	],
	roots: [
		{
			from: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
			kind: "FolderRenamed",
			to: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "daddy"],
			},
		},
	],
} as const;
