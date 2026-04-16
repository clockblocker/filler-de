import { z } from "zod/v3";

const styleValues = [
	"Arch",
	"Coll",
	"Expr",
	"Form",
	"Rare",
	"Slng",
	"Vrnc",
	"Vulg",
] as const;

// Source: https://universaldependencies.org/u/feat/Style.html
export const Style = z.enum(styleValues);
export type Style = z.infer<typeof Style>;

const reprForStyle = {
	Arch: "archaic",
	Coll: "colloquial",
	Expr: "expressive",
	Form: "formal",
	Rare: "rare",
	Slng: "slang",
	Vrnc: "vernacular",
	Vulg: "vulgar",
} satisfies Record<Style, string>;

function getReprForStyle(style: Style) {
	return reprForStyle[style];
}
