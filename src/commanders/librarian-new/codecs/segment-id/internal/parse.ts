import { err, ok, type Result } from "neverthrow";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	TreeNodeKind,
	TreeNodeKindSchema,
} from "../../../healer/library-tree/tree-node/types/atoms";
import {
	type FileNodeSegmentId,
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "../../types/segment-id";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSegmentIdError, makeZodError } from "../../errors";
import type { SegmentIdComponents } from "../../types/type-mappings";

/**
 * Parses segment ID into components with validation.
 * Generic parser that narrows based on TreeNodeKind.
 */
export function parseSegmentId<NK extends TreeNodeKind>(
	id: TreeNodeSegmentId,
): Result<SegmentIdComponents<NK>, CodecError> {
	const parts = id.split(NodeSegmentIdSeparator);

	if (parts.length < 2) {
		return err(
			makeSegmentIdError(
				"MissingParts",
				id,
				`Segment ID must have at least 2 parts separated by ${NodeSegmentIdSeparator}`,
				{ partsCount: parts.length },
			),
		);
	}

	const [rawCoreName, rawTargetKind, rawExtension] = parts;

	// Validate nodeName
	const nodeNameResult = NodeNameSchema.safeParse(rawCoreName);
	if (!nodeNameResult.success) {
		return err(
			makeSegmentIdError(
				"InvalidNodeName",
				id,
				nodeNameResult.error.issues[0]?.message ?? "Invalid node name",
				{ rawCoreName },
				makeZodError(
					nodeNameResult.error.issues,
					"NodeName validation failed",
					{ rawCoreName },
				),
			),
		);
	}
	const coreName = nodeNameResult.data;

	// Validate targetKind
	const targetKindResult = TreeNodeKindSchema.safeParse(rawTargetKind);
	if (!targetKindResult.success) {
		return err(
			makeSegmentIdError(
				"UnknownType",
				id,
				`Unknown TreeNodeKind: ${rawTargetKind}`,
				{ rawTargetKind },
				makeZodError(
					targetKindResult.error.issues,
					"TreeNodeKind validation failed",
					{ rawTargetKind },
				),
			),
		);
	}
	const targetKind = targetKindResult.data;

	// Validate extension based on kind
	switch (targetKind) {
		case TreeNodeKind.Section: {
			// Section must have empty extension (or no extension part)
			if (rawExtension !== undefined && rawExtension !== "") {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						id,
						"Section segment ID must not have extension",
						{ rawExtension },
					),
				);
			}
			return ok({
				coreName,
				targetKind: TreeNodeKind.Section,
			} as SegmentIdComponents<NK>);
		}

		case TreeNodeKind.Scroll: {
			// Scroll must have "md" extension
			if (rawExtension === undefined) {
				return err(
					makeSegmentIdError(
						"MissingParts",
						id,
						"Scroll segment ID must have extension",
						{ partsCount: parts.length },
					),
				);
			}
			const extensionResult = MdExtensionSchema.safeParse(rawExtension);
			if (!extensionResult.success) {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						id,
						`Scroll segment ID must have "md" extension, got: ${rawExtension}`,
						{ rawExtension },
						makeZodError(
							extensionResult.error.issues,
							"MdExtension validation failed",
							{ rawExtension },
						),
					),
				);
			}
			return ok({
				coreName,
				extension: "md",
				targetKind: TreeNodeKind.Scroll,
			} as SegmentIdComponents<NK>);
		}

		case TreeNodeKind.File: {
			// File must have extension
			if (rawExtension === undefined) {
				return err(
					makeSegmentIdError(
						"MissingParts",
						id,
						"File segment ID must have extension",
						{ partsCount: parts.length },
					),
				);
			}
			const extensionResult = FileExtensionSchema.safeParse(rawExtension);
			if (!extensionResult.success) {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						id,
						`Invalid file extension: ${rawExtension}`,
						{ rawExtension },
						makeZodError(
							extensionResult.error.issues,
							"FileExtension validation failed",
							{ rawExtension },
						),
					),
				);
			}
			return ok({
				coreName,
				extension: extensionResult.data,
				targetKind: TreeNodeKind.File,
			} as SegmentIdComponents<NK>);
		}
	}
}

/**
 * Type-specific convenience parsers for better type inference.
 */
export function parseSectionSegmentId(
	id: SegmentIdOf<TreeNodeKind.Section>,
): Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError> {
	return parseSegmentId<TreeNodeKind.Section>(id);
}

export function parseScrollSegmentId(
	id: SegmentIdOf<TreeNodeKind.Scroll>,
): Result<SegmentIdComponents<TreeNodeKind.Scroll>, CodecError> {
	return parseSegmentId<TreeNodeKind.Scroll>(id);
}

export function parseFileSegmentId(
	id: SegmentIdOf<TreeNodeKind.File>,
): Result<SegmentIdComponents<TreeNodeKind.File>, CodecError> {
	return parseSegmentId<TreeNodeKind.File>(id);
}
