import { z } from "zod/v3";

const germanGenusValues = ["Maskulinum", "Femininum", "Neutrum"] as const;

export const GermanGenusSchema = z.enum(germanGenusValues);
export type GermanGenus = z.infer<typeof GermanGenusSchema>;
export const GermanGenus = GermanGenusSchema.enum;
export const GERMAN_GENUS_VALUES = GermanGenusSchema.options;

export const articleFromGenus: Record<GermanGenus, "der" | "die" | "das"> = {
	Femininum: "die",
	Maskulinum: "der",
	Neutrum: "das",
};
