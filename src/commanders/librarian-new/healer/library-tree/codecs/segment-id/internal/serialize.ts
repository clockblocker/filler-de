import { err, ok, type Result } from "neverthrow";
import { NodeNameSchema } from "../../../../../types/schemas/node-name";
import {
	FileExtensionSchema,
	MdExtensionSchema,
	TreeNodeKind,
	TreeNodeKindSchema,
} from "../../../tree-node/types/atoms";
import {
	NodeSegmentIdSeparator,
	type TreeNodeSegmentId,
} from "../../../tree-node/types/node-segment-id";
import type { CodecError } from "../../errors";
import { makeSegmentIdError, makeZodError } from "../../errors";
import type { SegmentIdComponents } from "../../types/type-mappings";

/**
 * Serializes segment ID components to string.
 * Assumes validated inputs (NodeName, FileExtension are zod-validated types).
 */
export function serializeSegmentId<NK extends TreeNodeKind>(
	components: SegmentIdComponents<NK>,
): TreeNodeSegmentId {
	const { coreName, targetKind } = components;

	switch (targetKind) {
		case TreeNodeKind.Section: {
			return `${coreName}${NodeSegmentIdSeparator}${targetKind}${NodeSegmentIdSeparator}`;
		}
		case TreeNodeKind.Scroll: {
			const { extension } =
				components as SegmentIdComponents<TreeNodeKind.Scroll>;
			return `${coreName}${NodeSegmentIdSeparator}${targetKind}${NodeSegmentIdSeparator}${extension}`;
		}
		case TreeNodeKind.File: {
			const { extension } =
				components as SegmentIdComponents<TreeNodeKind.File>;
			return `${coreName}${NodeSegmentIdSeparator}${targetKind}${NodeSegmentIdSeparator}${extension}`;
		}
	}
}

/**
 * Serializes segment ID from unchecked inputs.
 * Validates inputs and returns Result.
 */
export function serializeSegmentIdUnchecked(components: {
	coreName: string;
	targetKind: TreeNodeKind;
	extension?: string;
}): Result<TreeNodeSegmentId, CodecError> {
	// Validate coreName
	const nodeNameResult = NodeNameSchema.safeParse(components.coreName);
	if (!nodeNameResult.success) {
		return err(
			makeSegmentIdError(
				"InvalidNodeName",
				components.coreName,
				nodeNameResult.error.issues[0]?.message ?? "Invalid node name",
				{ coreName: components.coreName },
				makeZodError(
					nodeNameResult.error.issues,
					"NodeName validation failed",
					{ coreName: components.coreName },
				),
			),
		);
	}
	const coreName = nodeNameResult.data;

	// Validate targetKind
	const targetKindResult = TreeNodeKindSchema.safeParse(
		components.targetKind,
	);
	if (!targetKindResult.success) {
		return err(
			makeSegmentIdError(
				"UnknownType",
				String(components.targetKind),
				`Unknown TreeNodeKind: ${components.targetKind}`,
				{ targetKind: components.targetKind },
				makeZodError(
					targetKindResult.error.issues,
					"TreeNodeKind validation failed",
					{ targetKind: components.targetKind },
				),
			),
		);
	}
	const targetKind = targetKindResult.data;

	// Validate extension based on kind
	switch (targetKind) {
		case TreeNodeKind.Section: {
			if (
				components.extension !== undefined &&
				components.extension !== ""
			) {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						components.extension,
						"Section segment ID must not have extension",
						{ extension: components.extension },
					),
				);
			}
			return ok(
				serializeSegmentId({
					coreName,
					targetKind: TreeNodeKind.Section,
				}),
			);
		}

		case TreeNodeKind.Scroll: {
			if (components.extension === undefined) {
				return err(
					makeSegmentIdError(
						"MissingParts",
						"",
						"Scroll segment ID must have extension",
						{ extension: components.extension },
					),
				);
			}
			const extensionResult = MdExtensionSchema.safeParse(
				components.extension,
			);
			if (!extensionResult.success) {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						components.extension,
						`Scroll segment ID must have "md" extension, got: ${components.extension}`,
						{ extension: components.extension },
						makeZodError(
							extensionResult.error.issues,
							"MdExtension validation failed",
							{ extension: components.extension },
						),
					),
				);
			}
			return ok(
				serializeSegmentId({
					coreName,
					extension: "md",
					targetKind: TreeNodeKind.Scroll,
				}),
			);
		}

		case TreeNodeKind.File: {
			if (components.extension === undefined) {
				return err(
					makeSegmentIdError(
						"MissingParts",
						"",
						"File segment ID must have extension",
						{ extension: components.extension },
					),
				);
			}
			const extensionResult = FileExtensionSchema.safeParse(
				components.extension,
			);
			if (!extensionResult.success) {
				return err(
					makeSegmentIdError(
						"InvalidExtension",
						components.extension,
						`Invalid file extension: ${components.extension}`,
						{ extension: components.extension },
						makeZodError(
							extensionResult.error.issues,
							"FileExtension validation failed",
							{ extension: components.extension },
						),
					),
				);
			}
			return ok(
				serializeSegmentId({
					coreName,
					extension: extensionResult.data,
					targetKind: TreeNodeKind.File,
				}),
			);
		}
	}
}
