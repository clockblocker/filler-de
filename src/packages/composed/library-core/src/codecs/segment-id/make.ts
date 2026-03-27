import type { Result } from "neverthrow";
import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
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
import type { SegmentIdOf } from "./types";
import type { TreeNodeSegmentId } from "./types/segment-id";

export type SegmentIdCodecs = {
	/** Generic parser (primary API) */
	parseSegmentId: <NK extends TreeNodeKind>(
		id: TreeNodeSegmentId,
	) => Result<SegmentIdComponents<NK>, CodecError>;

	/** Type-specific convenience parsers (better type inference) */
	parseSectionSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.Section>,
	) => Result<SegmentIdComponents<typeof TreeNodeKind.Section>, CodecError>;
	parseScrollSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.Scroll>,
	) => Result<SegmentIdComponents<typeof TreeNodeKind.Scroll>, CodecError>;
	parseFileSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.File>,
	) => Result<SegmentIdComponents<typeof TreeNodeKind.File>, CodecError>;

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
