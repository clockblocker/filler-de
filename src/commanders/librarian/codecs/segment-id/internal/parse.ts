import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	TreeNodeKind,
	TreeNodeKindSchema,
} from "../../../healer/library-tree/tree-node/types/atoms";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSegmentIdError, makeZodError } from "../../errors";
import type { SegmentIdComponents } from "../../types/type-mappings";
import type { SegmentIdOf } from "../types";
import {
	NodeSegmentIdSeparator,
	type TreeNodeSegmentId,
} from "../types/segment-id";

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
						`Scroll segment ID must have ${MD} extension, got: ${rawExtension}`,
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
				extension: MD,
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
	id: SegmentIdOf<typeof TreeNodeKind.Section>,
): Result<SegmentIdComponents<typeof TreeNodeKind.Section>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.Section>(id);
}

export function parseScrollSegmentId(
	id: SegmentIdOf<typeof TreeNodeKind.Scroll>,
): Result<SegmentIdComponents<typeof TreeNodeKind.Scroll>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.Scroll>(id);
}

export function parseFileSegmentId(
	id: SegmentIdOf<typeof TreeNodeKind.File>,
): Result<SegmentIdComponents<typeof TreeNodeKind.File>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.File>(id);
}
