import {
	INFLECTION,
	LinguisticUnit,
	PartOfSpeech,
	PhrasemeType,
} from '../general/consts/linguistics-consts';
import { MetaNoteType, NoteType } from './note-structure/note-structure-consts';

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
