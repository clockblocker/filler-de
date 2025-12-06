import z from "zod/v4";
import { SPACE_LIKE_CHARS, UNDERSCORE } from "../../../../types/literals";

export const toNodeName = (s: string) => {
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

export const NodeNameSchema = z.string().min(1);

export type NodeName = z.infer<typeof NodeNameSchema>;

export const TreePathSchema = z.array(NodeNameSchema);

export type TreePath = z.infer<typeof TreePathSchema>;
