import type { LemmaSchemaLanguageShape } from "../../registry-shapes";
import { EnglishLexemeLemmaSchemas } from "./lu/lexeme/english-lexemes";
import { EnglishMorphemeLemmaSchemas } from "./lu/morpheme/english-morphemes";
import { EnglishPhrasemeLemmaSchemas } from "./lu/phraseme/english-phrasemes";

export const EnglishLemmaSchema = {
	Lexeme: EnglishLexemeLemmaSchemas,
	Morpheme: EnglishMorphemeLemmaSchemas,
	Phraseme: EnglishPhrasemeLemmaSchemas,
} satisfies LemmaSchemaLanguageShape;
