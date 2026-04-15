import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { HebrewLexemeLemmaSchemas } from "./lu/lexeme/hebrew-lexemes";
import { HebrewMorphemeLemmaSchemas } from "./lu/morpheme/hebrew-morphemes";
import { HebrewPhrasemeLemmaSchemas } from "./lu/phraseme/hebrew-phrasemes";

export const HebrewLemmaSchema = {
	Lexeme: HebrewLexemeLemmaSchemas,
	Morpheme: HebrewMorphemeLemmaSchemas,
	Phraseme: HebrewPhrasemeLemmaSchemas,
} as unknown as LemmaSchemaLanguageShape;
