import type { LexicalInfo } from "@textfresser/lexical-generation";
import type { LexicalGenus } from "../../../domain/lexical-types";
import {
	getLexicalInfoGender,
	getLexicalInfoPos,
	isLexicalInfoLexeme,
} from "../../../domain/lexical-info-view";

type LexicalSectionQuery =
	| {
			unit: "Lexeme";
			pos: NonNullable<ReturnType<typeof getLexicalInfoPos>>;
	  }
	| { unit: "Phraseme" };

export function buildLexicalSectionQuery(
	lexicalInfo: LexicalInfo,
): LexicalSectionQuery {
	if (isLexicalInfoLexeme(lexicalInfo)) {
		return {
			pos: getLexicalInfoPos(lexicalInfo) ?? "X",
			unit: "Lexeme",
		};
	}

	return { unit: "Phraseme" };
}

export function resolveNounInflectionGender(
	lexicalInfo: LexicalInfo,
): LexicalGenus | undefined {
	if (!isLexicalInfoLexeme(lexicalInfo) || getLexicalInfoPos(lexicalInfo) !== "NOUN") {
		return undefined;
	}

	return getLexicalInfoGender(lexicalInfo);
}
