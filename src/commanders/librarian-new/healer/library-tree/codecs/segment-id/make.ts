import type {
	FileNodeSegmentId,
	SectionNodeSegmentId,
	ScrollNodeSegmentId,
	TreeNodeSegmentId,
} from "../../tree-node/types/node-segment-id";
import type { CodecError } from "../errors";
import type { CodecRules } from "../rules";
import type { SegmentIdComponents } from "../types/type-mappings";
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
import { TreeNodeKind } from "../../tree-node/types/atoms";

export type SegmentIdCodecs = {
	/** Generic parser (primary API) */
	parseSegmentId: <NK extends TreeNodeKind>(
		id: TreeNodeSegmentId,
	) => Result<SegmentIdComponents<NK>, CodecError>;

	/** Type-specific convenience parsers (better type inference) */
	parseSectionSegmentId: (
		id: SectionNodeSegmentId,
	) => Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError>;
	parseScrollSegmentId: (
		id: ScrollNodeSegmentId,
	) => Result<SegmentIdComponents<TreeNodeKind.Scroll>, CodecError>;
	parseFileSegmentId: (
		id: FileNodeSegmentId,
	) => Result<SegmentIdComponents<TreeNodeKind.File>, CodecError>;

	/** Serialize (validated inputs) */
	serializeSegmentId: <NK extends TreeNodeKind>(
		components: SegmentIdComponents<NK>,
	) => TreeNodeSegmentId;

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
		parseSegmentId,
		parseSectionSegmentId,
		parseScrollSegmentId,
		parseFileSegmentId,
		serializeSegmentId,
		serializeSegmentIdUnchecked,
	};
}
