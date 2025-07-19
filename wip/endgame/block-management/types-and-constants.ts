import { z } from 'zod/v4';

export const NEW_LINE = '\n';
export const VERTIKAL_STICK = ' | ';
export const LINE_BREAK = '\n';
export const COMMA = ',';
export const SPACE = ' ';
export const HASHTAG = '#';

const blockIds = [
	'Formen',
	'Kontexte',
	'Synonyme',
	'Morpheme',
	'Translations',
	'Related',
	'Flexion',
	'Grammatik',
	'Tags',
] as const;
// Assume these constants are defined elsewhere in your code:
const BlockIdSchema = z.enum(blockIds);

export const BlockId = BlockIdSchema.enum;
export type BlockId = z.infer<typeof BlockIdSchema>;
export const ALL_BLOCK_IDS = [...blockIds] as BlockId[];

type BlockProps = {
	cssClassName: string;
	deBlockTitle: string;
	preDelimeterSpacing: string;
	weight: number;
};

export const blockPropsFromBlockId: Record<BlockId, BlockProps> = {
	[BlockId.Formen]: {
		cssClassName: 'block_title_formen',
		deBlockTitle: 'Formen',
		preDelimeterSpacing: NEW_LINE,
		weight: 0,
	},
	[BlockId.Kontexte]: {
		cssClassName: 'block_title_kontexte',
		deBlockTitle: 'Kontexte',
		preDelimeterSpacing: `${NEW_LINE}${NEW_LINE}`,
		weight: 1,
	},
	[BlockId.Synonyme]: {
		cssClassName: 'block_title_synonyme',
		deBlockTitle: 'Beziehungen',
		preDelimeterSpacing: NEW_LINE,
		weight: 10,
	},
	[BlockId.Morpheme]: {
		cssClassName: 'block_title_morpheme',
		deBlockTitle: 'Morpheme',
		preDelimeterSpacing: NEW_LINE,
		weight: 20,
	},
	[BlockId.Translations]: {
		cssClassName: 'block_title_translations',
		deBlockTitle: 'Übersetzung',
		preDelimeterSpacing: NEW_LINE,
		weight: 30,
	},
	[BlockId.Related]: {
		cssClassName: 'block_title_related',
		deBlockTitle: 'Verweise',
		preDelimeterSpacing: NEW_LINE,
		weight: 40,
	},
	[BlockId.Flexion]: {
		cssClassName: 'block_title_flexion',
		deBlockTitle: 'Flexion',
		preDelimeterSpacing: NEW_LINE,
		weight: 50,
	},
	[BlockId.Grammatik]: {
		cssClassName: 'block_title_grammatik',
		deBlockTitle: 'Grammatik',
		preDelimeterSpacing: NEW_LINE,
		weight: 60,
	},
	[BlockId.Tags]: {
		cssClassName: 'block_title_tags',
		deBlockTitle: 'Tags',
		preDelimeterSpacing: NEW_LINE,
		weight: 100,
	},
};

const makeBlockHeaderElementFromBlockId = (id: BlockId) => {
	const { cssClassName, deBlockTitle } = blockPropsFromBlockId[id];
	return `<span class="block_title ${cssClassName}">${deBlockTitle}</span>`;
};

export const BLOCK_DELIMETER = '---' as const;
export type BlockContent = string;
export type BlockHeaderElement = string;
export type BlockPreDelimeterSpacing = string;

export type BlockStructure = {
	headerElement: BlockHeaderElement;
	content: BlockContent;
	preDelimeterSpacing: BlockPreDelimeterSpacing;
	delimeter: typeof BLOCK_DELIMETER;
};

export type BlockRepr = string;
export type FileContent = string;
export type ContentFromBlockId = Record<BlockId, BlockStructure['content']>;

export const reprFromBlockSchema = z.record(BlockIdSchema, z.string());

// ---
const meningfullBlockIdsSet = new Set([BlockId.Formen, BlockId.Kontexte]);
const blockIdForFlexersSet = new Set([
	BlockId.Synonyme,
	BlockId.Morpheme,
	BlockId.Translations,
	BlockId.Flexion,
]);

export const SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS = new Set([
	BlockId.Related,
	BlockId.Tags,
]);

export const RequiredSetOfBlockIdsFromWortart = {
	Nomen: new Set([
		...meningfullBlockIdsSet,
		...blockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Pronomen: new Set([
		...meningfullBlockIdsSet,
		...blockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Verb: new Set([
		...meningfullBlockIdsSet,
		...blockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Adjektiv: new Set([
		...meningfullBlockIdsSet,
		...blockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Numerale: new Set([
		...meningfullBlockIdsSet,
		...blockIdForFlexersSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Artikel: new Set([
		...meningfullBlockIdsSet,
		BlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Partikel: new Set([
		...meningfullBlockIdsSet,
		BlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Praeposition: new Set([
		...meningfullBlockIdsSet,
		BlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Konjunktion: new Set([
		...meningfullBlockIdsSet,
		BlockId.Grammatik,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Adverb: new Set([
		...meningfullBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Redewendung: new Set([
		...meningfullBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),
	Interjektion: new Set([
		...meningfullBlockIdsSet,
		...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	]),

	Unbekannt: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
	Morphem: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
	Praefix: new Set([...SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS]),
};

// ---

export const noteExample = `
<span class="block_title block_title_formen">Formen</span>
🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)

----
<span class="block_title block_title_kontexte">Deine Kontexte</span>
*[[Atom#^7|^]]* Polen will weg von der Kohle. Noch 2024 wurde weit über die [[Hälfte]] des polnischen Stroms durch [[Kohlekraftwerke]] [[erzeugt]] – mit fatalen Folgen für Klima und Umwelt. ^7


*[[Atom#^13|^]]* Wenn sie die [[Kohlekraftwerke]] [[abschalten]], womit werden wir dann heizen? Wir haben kleine Kinder, also sind wir [[dagegen]]. ^13


---
<span class="block_title block_title_synonyme">Semantische Beziehungen</span>
= [[Kraftwerk]], [[Stromerzeugungsanlage]], [[Stromerzeugungsanlage]]
≈ [[Industrieanlage]], [[Fabrik]]
≠ [[Windrad]], [[Solaranlage]]

---
<span class="block_title block_title_morpheme">Morpheme</span>
[[Kohle]]|[[kraft]]|[[werk]]|[[e]]
[[Kohle]] + [[Kraftwerke]]

---
<span class="block_title block_title_translations">Übersetzung</span>
coal-fired power plant | 
угольная электростанция | 

---
<span class="block_title block_title_related">Verweise</span>
[[Kohle]], [[Kraftwerk]]

---
<span class="block_title block_title_flexion">Flexion</span>
N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]  
A: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]  
G: des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]  
D: dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]]

---
<span class="block_title block_title_tags">Tags</span>
#Ablaut  #Ableitung  #Abtönung 
`;
