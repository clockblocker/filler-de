// { pathParts: NodeName[]; nodeName: NodeName }

import type { CommonSplitPath } from "../../../../../../obsidian-vault-action-manager/types/split-path";
import type { Prettify } from "../../../../../../types/helpers";
import type { NodeName } from "../../../../types/schemas/node-name";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

export type MakeCanonical<SP extends CommonSplitPath> = Prettify<
	Omit<SP, "basename"> & {
		nodeName: NodeName;
		sectionNames: NodeName[];
	}
>;

export type CanonicalSplitPathToFolderInsideLibrary =
	MakeCanonical<SplitPathToFolderInsideLibrary>;

export type CanonicalSplitPathToFileInsideLibrary =
	MakeCanonical<SplitPathToFileInsideLibrary>;

export type CanonicalSplitPathToMdFileInsideLibrary =
	MakeCanonical<SplitPathToMdFileInsideLibrary>;

export type CanonicalSplitPathInsideLibrary =
	| CanonicalSplitPathToFolderInsideLibrary
	| CanonicalSplitPathToFileInsideLibrary
	| CanonicalSplitPathToMdFileInsideLibrary;
