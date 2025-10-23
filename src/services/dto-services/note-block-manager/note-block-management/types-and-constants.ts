import { z } from "zod";

export const NEW_LINE = "\n";
export const VERTIKAL_STICK = " | ";
export const LINE_BREAK = "\n";
export const COMMA = ",";
export const SPACE = " ";
export const HASHTAG = "#";

const noteBlockIds = [
	"Formen",
	"Kontexte",
	"Synonyme",
	"Morpheme",
	"Translations",
	"Related",
	"Flexion",
	"Grammatik",
	"Tags",
] as const;
// Assume these constants are defined elsewhere in your code:
const NoteBlockIdSchema = z.enum(noteBlockIds);

export const NoteBlockId = NoteBlockIdSchema.enum;
export type NoteBlockId = z.infer<typeof NoteBlockIdSchema>;
export const ALL_BLOCK_IDS = [...noteBlockIds] as NoteBlockId[];

export const NOTE_BLOCK_TITLE_CSS_CLASS = "block_title";

type NoteBlockProps = {
	cssClassName: string;
	deBlockTitle: string;
	preDelimeterSpacing: string;
	weight: number;
};

export const noteBlockPropsFromNoteBlockId: Record<
	NoteBlockId,
	NoteBlockProps
> = {
	[NoteBlockId.Formen]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_formen`,
		deBlockTitle: "Formen",
		preDelimeterSpacing: NEW_LINE,
		weight: 0,
	},
	[NoteBlockId.Kontexte]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_kontexte`,
		deBlockTitle: "Kontexte",
		preDelimeterSpacing: `${NEW_LINE}${NEW_LINE}`,
		weight: 1,
	},
	[NoteBlockId.Synonyme]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_synonyme`,
		deBlockTitle: "Beziehungen",
		preDelimeterSpacing: NEW_LINE,
		weight: 10,
	},
	[NoteBlockId.Morpheme]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_morpheme`,
		deBlockTitle: "Morpheme",
		preDelimeterSpacing: NEW_LINE,
		weight: 20,
	},
	[NoteBlockId.Translations]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_translations`,
		deBlockTitle: "Übersetzung",
		preDelimeterSpacing: NEW_LINE,
		weight: 30,
	},
	[NoteBlockId.Related]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_related`,
		deBlockTitle: "Verweise",
		preDelimeterSpacing: NEW_LINE,
		weight: 40,
	},
	[NoteBlockId.Flexion]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_flexion`,
		deBlockTitle: "Flexion",
		preDelimeterSpacing: NEW_LINE,
		weight: 50,
	},
	[NoteBlockId.Grammatik]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_grammatik`,
		deBlockTitle: "Grammatik",
		preDelimeterSpacing: NEW_LINE,
		weight: 60,
	},
	[NoteBlockId.Tags]: {
		cssClassName: `${NOTE_BLOCK_TITLE_CSS_CLASS}_tags`,
		deBlockTitle: "Tags",
		preDelimeterSpacing: NEW_LINE,
		weight: 100,
	},
};

export const makeBlockHeaderElementFromNoteBlockId = (id: NoteBlockId) => {
	const { cssClassName, deBlockTitle } = noteBlockPropsFromNoteBlockId[id];
	return `<span class="${NOTE_BLOCK_TITLE_CSS_CLASS} ${cssClassName}">${deBlockTitle}</span>`;
};

export const BLOCK_DELIMETER = "---" as const;
export type BlockContent = string;
export type BlockHeaderElement = string;
export type NoteBlockPreDelimeterSpacing = string;

export type BlockStructure = {
	headerElement: BlockHeaderElement;
	content: BlockContent;
	preDelimeterSpacing: NoteBlockPreDelimeterSpacing;
	delimeter: typeof BLOCK_DELIMETER;
};

export type BlockRepr = string;
export type FileContent = string;
export type ContentFromNoteBlockId = Record<
	NoteBlockId,
	BlockStructure["content"]
>;

export const reprFromBlockSchema = z.record(NoteBlockIdSchema, z.string());

// ---
const meningfullNoteBlockIdsSet = new Set([
	NoteBlockId.Formen,
	NoteBlockId.Kontexte,
]);

const noteBlockIdForFlexersSet = new Set([
	NoteBlockId.Synonyme,
	NoteBlockId.Morpheme,
	NoteBlockId.Translations,
	NoteBlockId.Flexion,
]);

export const SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS = new Set([
	NoteBlockId.Related,
	NoteBlockId.Tags,
]);

export const RequiredSetOfNoteBlockIdsFromWortart = {
	Nomen: new Set([
		...meningfullNoteBlockIdsSet,
		...noteBlockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Pronomen: new Set([
		...meningfullNoteBlockIdsSet,
		...noteBlockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Verb: new Set([
		...meningfullNoteBlockIdsSet,
		...noteBlockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Adjektiv: new Set([
		...meningfullNoteBlockIdsSet,
		...noteBlockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Numerale: new Set([
		...meningfullNoteBlockIdsSet,
		...noteBlockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Artikel: new Set([
		...meningfullNoteBlockIdsSet,
		NoteBlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Partikel: new Set([
		...meningfullNoteBlockIdsSet,
		NoteBlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Praeposition: new Set([
		...meningfullNoteBlockIdsSet,
		NoteBlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Konjunktion: new Set([
		...meningfullNoteBlockIdsSet,
		NoteBlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Adverb: new Set([
		...meningfullNoteBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Redewendung: new Set([
		...meningfullNoteBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Interjektion: new Set([
		...meningfullNoteBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Unbekannt: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
	Morphem: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
	Praefix: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
};

// ---

export const noteExample = `

<span class="note_block_title note_block_title_formen">Als 
Nomen</span>
🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)
<span class="note_block_title note_block_title_kontexte">Deine Kontexte</span>
![[Atom#^13|^]]

![[Atom#^14|^]]
<span class="note_block_title note_block_title_synonyme">Semantische Beziehungen</span>
= [[Kraftwerk]], [[Stromerzeugungsanlage]], [[Stromerzeugungsanlage]] 
≈ [[Industrieanlage]], [[Fabrik]] 
≠ [[Windrad]], [[Solaranlage]] 
<span class="note_block_title note_block_title_morpheme">Morpheme</span>
 [[Kohle]]|[[kraft]]|[[werk]]|[[e]] 
 [[Kohle]] + [[Kraftwerke]] 
<span class="note_block_title note_block_title_translations">Übersetzung</span>
coal-fired power plant 
<span class="note_block_title note_block_title_related">Verweise</span>
 [[Kohle]], [[Kraftwerk]]
<span class="note_block_title note_block_title_flexion">Flexion</span>
N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]   
A: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]   
G: des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]   
D: dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]] 
<span class="note_block_title note_block_title_tags">Tags</span>
#Ablaut  #Ableitung  #Abtönung  
`;
