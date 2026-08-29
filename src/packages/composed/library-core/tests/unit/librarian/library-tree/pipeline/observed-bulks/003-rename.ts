import { MD } from "@textfresser/vault-action-manager";
import type { LibraryBulk } from "../../../../../../src/tree/library-scope";

export const bulkEvent: LibraryBulk = {
	events: [
		{
			from: {
				basename: "__-kid1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
			kind: "FileRenamed",
			to: {
				basename: "__-kid1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
		},
		{
			from: {
				basename: "ReName-kid1 1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
			kind: "FileRenamed",
			to: {
				basename: "ReName-kid1 1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
		},
		{
			from: {
				basename: "__-kid1 1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
			kind: "FileRenamed",
			to: {
				basename: "__-kid1 1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid3"],
			},
		},
		{
			from: {
				basename: "kid1 1",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
			kind: "FolderRenamed",
			to: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
		},
	],
	roots: [
		{
			from: {
				basename: "kid1 1",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
			kind: "FolderRenamed",
			to: {
				basename: "kid3",
				kind: "Folder",
				pathParts: ["Library", "parents", "mommy"],
			},
		},
	],
} as const;
