import type { CreateTreeLeafAction } from "../../../../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import { MD } from "../../../../../../src/managers/obsidian/vault-action-manager/types/literals";

export const createActions: CreateTreeLeafAction[] = [
	{
		actionType: "Create",
		observedSplitPath: {
			basename: "ReName-kid1-mommy-parents",
			extension: MD,
			kind: "MdFile",
			pathParts: ["Library", "parents", "mommy", "kid1"],
		},
		targetLocator: {
			segmentId: "ReName﹘Scroll﹘md",
			segmentIdChainToParent: [
				"Library﹘Section﹘",
				"parents﹘Section﹘",
				"mommy﹘Section﹘",
				"kid1﹘Section﹘",
			],
			targetKind: "Scroll",
		},
	},
	{
		actionType: "Create",
		observedSplitPath: {
			basename: "ReName-kid2-daddy-parents",
			extension: MD,
			kind: "MdFile",
			pathParts: ["Library", "parents", "daddy", "kid2"],
		},
		targetLocator: {
			segmentId: "ReName﹘Scroll﹘md",
			segmentIdChainToParent: [
				"Library﹘Section﹘",
				"parents﹘Section﹘",
				"daddy﹘Section﹘",
				"kid2﹘Section﹘",
			],
			targetKind: "Scroll",
		},
	},
] as const;
