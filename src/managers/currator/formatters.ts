import z from "zod/v4";
import {
	NON_BREAKING_HYPHEN,
	SPACE_LIKE_CHARS,
	UNDERSCORE,
	UnderscoreSchema,
} from "../../types/literals";

const replaceSpaceLikeChars = (s: string) => {
	return SPACE_LIKE_CHARS.reduce((s, ch) => s.replaceAll(ch, UNDERSCORE), s);
};

const GuardedNodeNameSchema = z
	.string()
	.transform((s) => replaceSpaceLikeChars(s));

export type GuardedNodeName = z.infer<typeof GuardedNodeNameSchema>;

const TreePathSchema = z.array(GuardedNodeNameSchema).min(1);
export type TreePath = z.infer<typeof TreePathSchema>;

const GuardedCodexNameSchema = z.templateLiteral([
	UnderscoreSchema,
	UnderscoreSchema,
	z.string(),
]);

export const GuardedCodexCodec = z.codec(
	GuardedCodexNameSchema,
	TreePathSchema,
	{
		decode: (s) => s.slice(2).split(NON_BREAKING_HYPHEN),
		encode: (path) =>
			`${UNDERSCORE}${UNDERSCORE}${path.join(NON_BREAKING_HYPHEN)}` as const,
	},
);
