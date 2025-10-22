import type { INFLECTION } from "../../literals";
import {
	LinguisticUnit,
	type PartOfSpeech,
	type PhrasemeType,
} from "../linguistics/general-linguistic-enums/linguistics-enums";
import type {
	MetaNoteType,
	NoteType,
} from "./note-structure/note-structure-consts";

type AbstractNote<T extends NoteType = NoteType> = {
	surface: string;
	noteType: T;
};

type AbstactMetaNote = AbstractNote<MetaNoteType>;

const a = LinguisticUnit.Inflection;

type InflectionNote = AbstractNote<INFLECTION> & {
	baseForm: string;
	pos: PartOfSpeech;
};

type AbstractLinguisticNote = AbstractNote<LinguisticUnit> & {
	phrasemeType: PhrasemeType;
	baseForm: string;
	pos: PartOfSpeech;
};
