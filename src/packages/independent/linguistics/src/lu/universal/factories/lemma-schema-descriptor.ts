import type z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";

export type LemmaSchemaDescriptor<
	Schema extends z.ZodTypeAny,
	LanguageLiteral extends TargetLanguage = TargetLanguage,
> = {
	language: LanguageLiteral;
	schema: Schema;
};

export function defineLemmaSchemaDescriptor<
	LanguageLiteral extends TargetLanguage,
	Schema extends z.ZodTypeAny,
>({
	language,
	schema,
}: LemmaSchemaDescriptor<Schema, LanguageLiteral>): LemmaSchemaDescriptor<
	Schema,
	LanguageLiteral
> {
	return {
		language,
		schema,
	};
}
