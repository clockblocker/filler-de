import { MD } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	TreeNodeKind,
	TreeNodeKindSchema,
} from "../../../healer/library-tree/tree-node/types/atoms";
import { nodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSegmentIdError, makeZodError } from "../../errors";
import type { CodecRules } from "../../rules";
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
	rules: CodecRules,
	id: TreeNodeSegmentId,
): Result.Result<SegmentIdComponents<NK>, CodecError> {
	const parts = id.split(NodeSegmentIdSeparator);

	if (parts.length < 2) {
		return Result.fail(
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
	const nodeNameResult = nodeNameSchema(
		rules.suffixDelimiterPattern,
	).safeParse(rawCoreName);
	if (!nodeNameResult.success) {
		return Result.fail(
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
		return Result.fail(
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
				return Result.fail(
					makeSegmentIdError(
						"InvalidExtension",
						id,
						"Section segment ID must not have extension",
						{ rawExtension },
					),
				);
			}
			return Result.succeed({
				coreName,
				targetKind: TreeNodeKind.Section,
			} as SegmentIdComponents<NK>);
		}

		case TreeNodeKind.Scroll: {
			if (rawExtension === undefined) {
				return Result.fail(
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
				return Result.fail(
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
			return Result.succeed({
				coreName,
				extension: MD,
				targetKind: TreeNodeKind.Scroll,
			} as SegmentIdComponents<NK>);
		}

		case TreeNodeKind.File: {
			// File must have extension
			if (rawExtension === undefined) {
				return Result.fail(
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
				return Result.fail(
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
			return Result.succeed({
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
	rules: CodecRules,
	id: SegmentIdOf<typeof TreeNodeKind.Section>,
): Result.Result<SegmentIdComponents<typeof TreeNodeKind.Section>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.Section>(rules, id);
}

export function parseScrollSegmentId(
	rules: CodecRules,
	id: SegmentIdOf<typeof TreeNodeKind.Scroll>,
): Result.Result<SegmentIdComponents<typeof TreeNodeKind.Scroll>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.Scroll>(rules, id);
}

export function parseFileSegmentId(
	rules: CodecRules,
	id: SegmentIdOf<typeof TreeNodeKind.File>,
): Result.Result<SegmentIdComponents<typeof TreeNodeKind.File>, CodecError> {
	return parseSegmentId<typeof TreeNodeKind.File>(rules, id);
}
