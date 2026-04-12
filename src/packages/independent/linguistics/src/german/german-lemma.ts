import type { LemmaSchemaLanguageShape } from "../registry-shapes";
import { GermanLexemeLemmaSchemas } from "./lu/lexeme/german-lexemes";
import { GermanMorphemeLemmaSchemas } from "./lu/morpheme/german-morphemes";
import { GermanPhrasemeLemmaSchemas } from "./lu/phraseme/german-phrasemes";

export const GermanLemmaSchema = {
	Lexeme: GermanLexemeLemmaSchemas,
	Morpheme: GermanMorphemeLemmaSchemas,
	Phraseme: GermanPhrasemeLemmaSchemas,
} satisfies LemmaSchemaLanguageShape;
