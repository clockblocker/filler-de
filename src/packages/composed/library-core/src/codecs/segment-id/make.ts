import type { Result } from "effect";
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
	) => Result.Result<SegmentIdComponents<NK>, CodecError>;

	/** Type-specific convenience parsers (better type inference) */
	parseSectionSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.Section>,
	) => Result.Result<
		SegmentIdComponents<typeof TreeNodeKind.Section>,
		CodecError
	>;
	parseScrollSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.Scroll>,
	) => Result.Result<
		SegmentIdComponents<typeof TreeNodeKind.Scroll>,
		CodecError
	>;
	parseFileSegmentId: (
		id: SegmentIdOf<typeof TreeNodeKind.File>,
	) => Result.Result<
		SegmentIdComponents<typeof TreeNodeKind.File>,
		CodecError
	>;

	/** Serialize (validated inputs) */
	serializeSegmentId: <NK extends TreeNodeKind>(
		components: SegmentIdComponents<NK>,
	) => SegmentIdOf<NK>;

	/** Serialize (unchecked inputs) */
	serializeSegmentIdUnchecked: (components: {
		coreName: string;
		targetKind: TreeNodeKind;
		extension?: string;
	}) => Result.Result<TreeNodeSegmentId, CodecError>;
};

export function makeSegmentIdCodecs(rules: CodecRules): SegmentIdCodecs {
	// NodeSegmentIdSeparator is a constant; node names are validated
	// against the rules' suffix delimiter.
	return {
		parseFileSegmentId: (id) => parseFileSegmentId(rules, id),
		parseScrollSegmentId: (id) => parseScrollSegmentId(rules, id),
		parseSectionSegmentId: (id) => parseSectionSegmentId(rules, id),
		parseSegmentId: <NK extends TreeNodeKind>(id: TreeNodeSegmentId) =>
			parseSegmentId<NK>(rules, id),
		serializeSegmentId,
		serializeSegmentIdUnchecked: (components) =>
			serializeSegmentIdUnchecked(rules, components),
	};
}
