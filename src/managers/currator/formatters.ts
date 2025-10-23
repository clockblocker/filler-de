import z from "zod/v4";
import {
	DASH,
	NON_BREAKING_HYPHEN,
	SPACE_LIKE_CHARS,
	UNDERSCORE,
	UnderscoreSchema,
} from "../../types/literals";

export const toGuardedNodeName = (s: string) => {
	const result = SPACE_LIKE_CHARS.reduce(
		(s, ch) => s.replaceAll(ch, UNDERSCORE),
		s,
	).replaceAll(NON_BREAKING_HYPHEN, DASH);
	return result.replace(/_+/g, UNDERSCORE);
};

const GuardedNodeNameSchema = z.string().min(1);

export type GuardedNodeName = z.infer<typeof GuardedNodeNameSchema>;

const GuardedCodexNameSchema = z.templateLiteral([
	UnderscoreSchema,
	UnderscoreSchema,
	z.string().min(1),
]);

export type GuardedCodexName = z.infer<typeof GuardedCodexNameSchema>;

export const CodexNameFromTreePath = z.codec(
	GuardedCodexNameSchema,
	z.array(GuardedNodeNameSchema).min(1),
	{
		decode: (s) => s.slice(2).split(NON_BREAKING_HYPHEN),
		encode: (path) =>
			`${UNDERSCORE}${UNDERSCORE}${path.join(NON_BREAKING_HYPHEN)}` as const,
	},
);

const numRepr = z.int().min(0).max(9);

const GuardedPageNameSchema = z.templateLiteral([
	numRepr,
	numRepr,
	numRepr,
	NON_BREAKING_HYPHEN,
	z.string().min(1),
]);

export const PageNameFromTreePath = z.codec(
	GuardedPageNameSchema,
	z.array(GuardedNodeNameSchema).min(2),
	{
		decode: (name) => {
			const [num, ...path] = name.split(NON_BREAKING_HYPHEN);
			return [...path, String(Number(num))];
		},
		encode: (path) => {
			const pathCopy = [...path];
			const mbNum = pathCopy.pop();
			const paddedNumRepr = String(Number(mbNum) ?? "0").padStart(3, "0");
			const nums = paddedNumRepr.split("").map(Number);
			return `${nums[0] ?? 0}${nums[1] ?? 0}${nums[2] ?? 0}${NON_BREAKING_HYPHEN}${pathCopy.join(NON_BREAKING_HYPHEN)}` as const;
		},
	},
);
