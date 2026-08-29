import { MD } from "@textfresser/vault-action-manager";
import type { LibraryBulk } from "../../../../../../src/tree/library-scope";

export const bulkEvent: LibraryBulk = {
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
