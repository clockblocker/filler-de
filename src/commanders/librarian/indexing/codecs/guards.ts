import z from "zod/v4";
import { SPACE_LIKE_CHARS, UNDERSCORE } from "../../../../types/literals";

export const toNodeNameLegacy = (s: string) => {
	const result = SPACE_LIKE_CHARS.reduce(
		(s, ch) => s.replaceAll(ch, UNDERSCORE),
		s,
	);

	return result
		.replace(/_+/g, UNDERSCORE)
		.replaceAll("/", "")
		.replaceAll("|", "")
		.replaceAll("\\", "")
		.replaceAll(":", "");
};

export const NodeNameLegacySchemaLegacy = z.string().min(1);

export type NodeNameLegacy = z.infer<typeof NodeNameLegacySchemaLegacy>;

export const TreePathLegacyLegacySchemaLegacy = z.array(
	NodeNameLegacySchemaLegacy,
);

export type TreePathLegacyLegacy = z.infer<
	typeof TreePathLegacyLegacySchemaLegacy
>;
