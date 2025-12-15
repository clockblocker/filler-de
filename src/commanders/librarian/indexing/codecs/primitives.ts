import z from "zod/v4";

const digitRepr = z.literal(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

export const intInPageRangeSchemaLegacy = z.int().min(0).max(999);

export const PageNumberSchemaLegacy = z.templateLiteral([
	digitRepr,
	digitRepr,
	digitRepr,
]);

export type PageNumber = z.infer<typeof PageNumberSchemaLegacy>;

export const pageNumberFromInt = z.codec(
	PageNumberSchemaLegacy,
	intInPageRangeSchemaLegacy,
	{
		decode: (paddedNumRepr) =>
			intInPageRangeSchemaLegacy.parse(Number(paddedNumRepr)),
		encode: (num) =>
			PageNumberSchemaLegacy.parse(String(num).padStart(3, "0")),
	},
);

export const intFromPageNumberStringLegacy = z.codec(
	intInPageRangeSchemaLegacy,
	z.string(),
	{
		decode: (num) => String(num).padStart(3, "0"),
		encode: (str) =>
			intInPageRangeSchemaLegacy.parse(Number(str.toString())),
	},
);
