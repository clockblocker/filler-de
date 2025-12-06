import z from "zod/v4";

const digitRepr = z.literal(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

export const intInPageRangeSchema = z.int().min(0).max(999);

export const PageNumberSchema = z.templateLiteral([
	digitRepr,
	digitRepr,
	digitRepr,
]);

export type PageNumber = z.infer<typeof PageNumberSchema>;

export const pageNumberFromInt = z.codec(PageNumberSchema, intInPageRangeSchema, {
	decode: (paddedNumRepr) => intInPageRangeSchema.parse(Number(paddedNumRepr)),
	encode: (num) => PageNumberSchema.parse(String(num).padStart(3, "0")),
});

export const intFromPageNumberString = z.codec(intInPageRangeSchema, z.string(), {
	decode: (num) => String(num).padStart(3, "0"),
	encode: (str) => intInPageRangeSchema.parse(Number(str.toString())),
});

