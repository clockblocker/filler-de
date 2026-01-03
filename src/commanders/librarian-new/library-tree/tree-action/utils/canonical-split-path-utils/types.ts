// { pathParts: NodeName[]; nodeName: NodeName }

import type {
	CommonSplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../obsidian-vault-action-manager/types/split-path";
import type { Prettify } from "../../../../../../types/helpers";
import type { NodeName } from "../../../../types/schemas/node-name";

export type MakeCanonical<SP extends CommonSplitPath> = Prettify<
	Omit<SP, "basename"> & {
		nodeName: NodeName;
		sectionNames: NodeName[];
	}
>;

export type CanonicalSplitPathToFolder = MakeCanonical<SplitPathToFolder>;

export type CanonicalSplitPathToFile = MakeCanonical<SplitPathToFile>;

export type CanonicalSplitPathToMdFile = MakeCanonical<SplitPathToMdFile>;

export type CanonicalSplitPath =
	| CanonicalSplitPathToFolder
	| CanonicalSplitPathToFile
	| CanonicalSplitPathToMdFile;
