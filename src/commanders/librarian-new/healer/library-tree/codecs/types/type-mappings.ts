import { SplitPathKind } from "../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../../types/schemas/node-name";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { TreeNodeLocator } from "../../tree-action/types/target-chains";
import type { CanonicalSplitPathInsideLibrary } from "../../tree-action/utils/canonical-naming/types";
import type { FileExtension } from "../../tree-node/types/atoms";
import { TreeNodeKind } from "../../tree-node/types/atoms";

/**
 * Inverts a record type, swapping keys and values.
 * Used to derive reverse mapping from TreeNodeKind → SplitPathKind.
 */
type InvertRecord<R extends Record<PropertyKey, PropertyKey>> = {
	[K in keyof R as R[K]]: K;
};

/**
 * Single source of truth: TreeNodeKind → SplitPathKind mapping.
 * Exhaustiveness checked via `satisfies Record<...>`.
 */
export const TreeNodeKindToSplitPathKind = {
	[TreeNodeKind.Section]: SplitPathKind.Folder,
	[TreeNodeKind.Scroll]: SplitPathKind.MdFile,
	[TreeNodeKind.File]: SplitPathKind.File,
} as const satisfies Record<TreeNodeKind, SplitPathKind>;

/**
 * Reverse mapping derived type-level (reduces drift risk).
 */
type SplitPathKindToTreeNodeKind = InvertRecord<
	typeof TreeNodeKindToSplitPathKind
>;

/**
 * Maps TreeNodeKind to corresponding SplitPathKind.
 * @example
 * type FolderKind = CorrespondingSplitPathKind<TreeNodeKind.Section>; // SplitPathKind.Folder
 */
export type CorrespondingSplitPathKind<NK extends TreeNodeKind> =
	(typeof TreeNodeKindToSplitPathKind)[NK];

/**
 * Maps SplitPathKind to corresponding TreeNodeKind.
 * @example
 * type SectionKind = CorrespondingTreeNodeKind<SplitPathKind.Folder>; // TreeNodeKind.Section
 */
export type CorrespondingTreeNodeKind<SK extends SplitPathKind> =
	SplitPathKindToTreeNodeKind[SK];

/**
 * Helper type combining mapping with existing SplitPath generic.
 * @example
 * type FolderPath = SplitPathForTreeNodeKind<TreeNodeKind.Section>; // SplitPath<SplitPathKind.Folder>
 */
export type SplitPathForTreeNodeKind<T extends TreeNodeKind> =
	import("../../../../../../managers/obsidian/vault-action-manager/types/split-path").SplitPath<
		CorrespondingSplitPathKind<T>
	>;

/**
 * Helper type for getting TreeNodeKind from SplitPathKind.
 */
export type TreeNodeKindForSplitPath<T extends SplitPathKind> =
	CorrespondingTreeNodeKind<T>;

/**
 * Generic locator type (narrows TreeNodeLocator union).
 * @example
 * type SectionLocator = NodeLocatorOf<TreeNodeKind.Section>; // SectionNodeLocator
 */
export type NodeLocatorOf<NK extends TreeNodeKind> = Extract<
	TreeNodeLocator,
	{ targetKind: NK }
>;

/**
 * Generic split path inside library (narrows union).
 * Using "Of" suffix to avoid name collision with union type SplitPathInsideLibrary.
 * @example
 * type FolderInsideLibrary = SplitPathInsideLibraryOf<SplitPathKind.Folder>;
 */
export type SplitPathInsideLibraryOf<SK extends SplitPathKind> = Extract<
	SplitPathInsideLibrary,
	{ kind: SK }
>;

/**
 * Generic canonical split path inside library (narrows union, same pattern as SplitPath).
 * Using "Of" suffix to avoid name collision with union type CanonicalSplitPathInsideLibrary.
 * @example
 * type CanonicalFolder = CanonicalSplitPathInsideLibraryOf<SplitPathKind.Folder>;
 */
export type CanonicalSplitPathInsideLibraryOf<SK extends SplitPathKind> =
	Extract<CanonicalSplitPathInsideLibrary, { kind: SK }>;

/**
 * Segment ID components mapped to full shapes (makes invalid states impossible).
 * Each kind has its exact shape with no optional fields where they shouldn't exist.
 */
type SegmentIdComponentsMap = {
	[TreeNodeKind.Section]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Section;
		extension?: never; // <-- forbidden, prevents extension from sneaking in
	};
	[TreeNodeKind.Scroll]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Scroll;
		extension: "md";
	};
	[TreeNodeKind.File]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.File;
		extension: FileExtension;
	};
};

/**
 * Generic segment ID components (narrows based on TreeNodeKind).
 * Makes invalid states unrepresentable (e.g., Section cannot have extension).
 * @example
 * type ScrollComponents = SegmentIdComponents<TreeNodeKind.Scroll>; // { coreName: NodeName; targetKind: TreeNodeKind.Scroll; extension: "md" }
 */
export type SegmentIdComponents<NK extends TreeNodeKind> =
	SegmentIdComponentsMap[NK];
