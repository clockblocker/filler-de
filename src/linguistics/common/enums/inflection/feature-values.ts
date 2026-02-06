import { z } from "zod/v3";

// -- Number --

const NUMBER_VALUES = ["Singular", "Plural"] as const;

export const NumberValueSchema = z.enum(NUMBER_VALUES);
export type NumberValue = z.infer<typeof NumberValueSchema>;
export const NumberValue = NumberValueSchema.enum;
export const NUMBER_VALUE_OPTIONS = NumberValueSchema.options;

// -- Case --

const CASE_VALUES = ["Nominative", "Accusative", "Dative", "Genitive"] as const;

export const CaseValueSchema = z.enum(CASE_VALUES);
export type CaseValue = z.infer<typeof CaseValueSchema>;
export const CaseValue = CaseValueSchema.enum;
export const CASE_VALUE_OPTIONS = CaseValueSchema.options;
