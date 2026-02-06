import {
	LinguisticUnit,
	type PhrasemeType,
	type POS,
} from "../../../linguistics/old-enums";
import type { INFLECTION } from "../../literals";
import type {
	MetaNoteType,
	NoteType,
} from "./note-structure/note-structure-consts";

type AbstractNote<T extends NoteType = NoteType> = {
	surface: string;
	noteType: T;
};

type AbstactMetaNote = AbstractNote<MetaNoteType>;

const _a = LinguisticUnit.Inflection;

type InflectionNote = AbstractNote<INFLECTION> & {
	baseForm: string;
	pos: POS;
};

type AbstractLinguisticNote = AbstractNote<LinguisticUnit> & {
	phrasemeType: PhrasemeType;
	baseForm: string;
	pos: POS;
};
