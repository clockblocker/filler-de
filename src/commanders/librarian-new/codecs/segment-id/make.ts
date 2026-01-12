import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "./types/segment-id";
import type { CodecError } from "../errors";
import type { CodecRules } from "../rules";
import type { SegmentIdComponents } from "../types/type-mappings";
import type { SegmentIdOf } from "./types";
import {
	parseFileSegmentId,
	parseScrollSegmentId,
	parseSectionSegmentId,
	parseSegmentId,
} from "./internal/parse";
import {
	serializeSegmentId,
	serializeSegmentIdUnchecked,
} from "./internal/serialize";

export type SegmentIdCodecs = {
	/** Generic parser (primary API) */
	parseSegmentId: <NK extends TreeNodeKind>(
		id: TreeNodeSegmentId,
	) => Result<SegmentIdComponents<NK>, CodecError>;

	/** Type-specific convenience parsers (better type inference) */
	parseSectionSegmentId: (
		id: SegmentIdOf<TreeNodeKind.Section>,
	) => Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError>;
	parseScrollSegmentId: (
		id: SegmentIdOf<TreeNodeKind.Scroll>,
	) => Result<SegmentIdComponents<TreeNodeKind.Scroll>, CodecError>;
	parseFileSegmentId: (
		id: SegmentIdOf<TreeNodeKind.File>,
	) => Result<SegmentIdComponents<TreeNodeKind.File>, CodecError>;

	/** Serialize (validated inputs) */
	serializeSegmentId: <NK extends TreeNodeKind>(
		components: SegmentIdComponents<NK>,
	) => SegmentIdOf<NK>;

	/** Serialize (unchecked inputs) */
	serializeSegmentIdUnchecked: (components: {
		coreName: string;
		targetKind: TreeNodeKind;
		extension?: string;
	}) => Result<TreeNodeSegmentId, CodecError>;
};

export function makeSegmentIdCodecs(_rules: CodecRules): SegmentIdCodecs {
	// Note: NodeSegmentIdSeparator is a constant, not from rules
	return {
		parseFileSegmentId,
		parseScrollSegmentId,
		parseSectionSegmentId,
		parseSegmentId,
		serializeSegmentId,
		serializeSegmentIdUnchecked,
	};
}
