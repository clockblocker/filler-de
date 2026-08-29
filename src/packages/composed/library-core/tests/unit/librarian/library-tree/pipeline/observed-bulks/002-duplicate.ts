import { MD } from "@textfresser/vault-action-manager";
import type { LibraryBulk } from "../../../../../../src/tree/library-scope";

export const bulkEvent: LibraryBulk = {
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
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
		},
		{
			kind: "FileCreated",
			splitPath: {
				basename: "__-kid1-mommy-parents",
				extension: MD,
				kind: "MdFile",
				pathParts: ["Library", "parents", "mommy", "kid1 1"],
			},
		},
	],
	roots: [],
} as const;
