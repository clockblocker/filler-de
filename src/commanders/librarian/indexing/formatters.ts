import z from "zod/v4";
import {
	DASH,
	SPACE_LIKE_CHARS,
	UNDERSCORE,
	UnderscoreSchema,
} from "../../../types/literals";

// const numRepr = z.int().min(0).max(9);
const digitRepr = z.literal(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const toDigitRepr = (num: number) =>
	num > 0
		? num < 10
			? digitRepr.parse(num.toString())
			: digitRepr.parse("9")
		: digitRepr.parse("0");

const intInPageRangeSchema = z.int().min(0).max(999);

const pageNumberReprSchema = z.templateLiteral([
	digitRepr,
	digitRepr,
	digitRepr,
]);

const paddedNumberReprFromIntInPageRange = z.codec(
	pageNumberReprSchema,
	intInPageRangeSchema,
	{
		decode: (paddedNumRepr) =>
			intInPageRangeSchema.parse(Number(paddedNumRepr)),
		encode: (num) =>
			pageNumberReprSchema.parse(String(num).padStart(3, "0")),
	},
);

const intInPageRangeFromString = z.codec(intInPageRangeSchema, z.string(), {
	decode: (num) => String(num).padStart(3, "0"),
	encode: (str) => intInPageRangeSchema.parse(Number(str.toString())),
});

export const toGuardedNodeName = (s: string) => {
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

const GuardedNodeNameSchema = z.string().min(1);

export type GuardedNodeName = z.infer<typeof GuardedNodeNameSchema>;

export const GuardedCodexNameSchema = z.templateLiteral([
	UnderscoreSchema,
	UnderscoreSchema,
	z.string().min(1),
]);

export type GuardedCodexName = z.infer<typeof GuardedCodexNameSchema>;

export const codexNameFromTreePath = z.codec(
	GuardedCodexNameSchema,
	z.array(GuardedNodeNameSchema).min(1),
	{
		decode: (s) => s.slice(2).split(DASH).toReversed(),
		encode: (path) =>
			`${UNDERSCORE}${UNDERSCORE}${path.toReversed().join(DASH)}` as const,
	},
);

export const GuardedPageNameSchema = z.templateLiteral([
	pageNumberReprSchema,
	DASH,
	z.string().min(1),
]);

export const pageNameFromTreePath = z.codec(
	GuardedPageNameSchema,
	z.array(GuardedNodeNameSchema).min(2),
	{
		decode: (name) => {
			const [num, ...path] = name.split(DASH);
			// intInPageRangeFromString returns a number in expected range, type safe
			if (!num) {
				throw new Error("num is undefined");
			}
			const decodedNum = intInPageRangeFromString.decode(Number(num));
			return [decodedNum, ...path].toReversed();
		},
		encode: (path) => {
			const pathCopy = [...path];
			const mbNum = pathCopy.pop();
			if (!mbNum) {
				throw new Error("mbNum is undefined");
			}
			const paddedNumRepr = paddedNumberReprFromIntInPageRange.encode(
				intInPageRangeFromString.encode(String(mbNum)),
			);
			return `${paddedNumRepr}${DASH}${pathCopy.toReversed().join(DASH)}` as const;
		},
	},
);

export const GuardedScrollNameSchema = z.templateLiteral([z.string().min(1)]);

export const scrollNameFromTreePath = z.codec(
	GuardedScrollNameSchema,
	z.array(GuardedNodeNameSchema).min(2),
	{
		decode: (name) => {
			const treePath = name.split(DASH).toReversed();
			return treePath;
		},
		encode: (path) => {
			return path.toReversed().join(DASH);
		},
	},
);
