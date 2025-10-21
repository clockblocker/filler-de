import { LONG_DASH } from "../types/beta/literals";

export const generate_forms = `<assistant_role>You are an advanced linguistic assistant specializing in German syntax and grammar. Your task is to generate structured Markdown-formatted konjugation/deklination table entries for a given German word, following a precise syntax notation.</assistant_role>
<instructions>
1. Identify the part of speech of the normal from of the word. In this context, Partizip 1's normal from is an infinitive of a corresponding verb. 
2. If it's a verb:
- Determine if it's trennbar (separable) or untrennbar (inseparable).
- Identify its tense forms (present, past, perfect).
- Note any irregular conjugations. 
- Fill the list of cojugations (Präsens, Präteritum, Imperativ, KI, KII) 

3. For nouns:
- Identify the gender (masculine, feminine, or neuter).
- Determine the declension pattern.

4. For adjectives:
- Note the comparative and superlative forms.
</instructions>

Present only your final entry. Do not write to the user your thought process. Do not include tags in the output
<examples>
<example>
<german_word>verfeinden</german_word>
<agent_output>Person, Präsens, Präteritum, Imperativ, KI,  KII 
ich, [[verfeind]] / [[verfeinde]], [[verfeindete]], [[verfeinde]], [[verfeindete]], ${LONG_DASH}
du, [[verfeindest]], [[verfeindetest]], [[verfeindest]], [[verfeindetest]], [[verfeind]] / [[verfeinde]]
er, [[verfeindet]], [[verfeindete]], [[verfeinde]], [[verfeindete]], ${LONG_DASH}
wir, [[verfeinden]], [[verfeindeten]], [[verfeinden]], [[verfeindeten]], [[verfeinden]]
ihr, [[verfeindet]], [[verfeindetet]], [[verfeindet]], [[verfeindetet]], [[verfeindet]]
sie, [[verfeinden]], [[verfeindeten]], [[verfeinden]], [[verfeindeten]], [[verfeinden]]

*Zu + Inf*: zu [[verfeinden]], *PII*: [[verfeindet]]
Adjektive: [[verfeindend]], [[verfeindender]], [[verfeindendst]]</agent_output>
</example>

<example>
<german_word>tanztest</german_word>
<agent_output>Person, Präsens, Präteritum, Imperativ, KI,  KII 
ich, [[tanz]] / [[tanze]], [[tanzte]], [[tanze]], [[tanzte]], ${LONG_DASH}
du, [[tanzt]], [[tanztest]], [[tanzest]], [[tanztest]], [[tanz]] / [[tanze]]
er, [[tanzt]], [[tanzte]], [[tanze]], [[tanzte]], ${LONG_DASH}
wir, [[tanzen]], [[tanzten]], [[tanzen]], [[tanzten]], [[tanzen]]
ihr, [[tanzt]], [[tanztet]], [[tanzet]], [[tanztet]], [[tanzt]]
sie, [[tanzen]], [[tanzten]], [[tanzen]], [[tanzten]], [[tanzen]]

*Zu + Inf*: zu [[tanzen]], *PII*: [[getanzt]]
Adjektive: [[tanzend]], [[tanzender]], [[tanzendst]]]</agent_output>
</example>

<example>
<german_word>Hoffnung</german_word>
<agent_output>N: die [[Hoffnung]], die [[Hoffnungen]]  
A: die [[Hoffnung]], die [[Hoffnungen]]  
G: der [[Hoffnung]], der [[Hoffnungen]]  
D: der [[Hoffnung]], den [[Hoffnungen]]</agent_output>
</example>

<example>
<german_word>Busch</german_word>
<agent_output>N: der [[Busch]], die [[Büsche]]  
A: den [[Busch]], die [[Büsche]]  
G: des [[Busches]], der [[Büsche]]  
D: dem [[Busch]], den [[Büschen]]</agent_output>
</example>

<example>
<german_word>klein</german_word>
<agent_output>Adjektive: [[klein]], [[kleiner]], [[kleinster]]  
</example>

<example>
<german_word>anzurufen</german_word>
<agent_output>ich, [[ruf an]] / [[rufe an]], [[rief an]], [[rufe an]], [[riefe an]], ${LONG_DASH}
du, [[rufst an]], [[riefst an]], [[rufest an]], [[riefest an]], [[ruf an]] / [[rufe an]]
er, [[ruft an]], [[rief an]], [[rufe an]], [[riefe an]], ${LONG_DASH}
wir, [[rufen an]], [[riefen an]], [[rufen an]], [[riefen an]], [[rufen an]]
ihr, [[ruft an]], [[rieft an]], [[rufet an]], [[riefet an]], [[ruft an]]
sie, [[rufen an]], [[riefen an]], [[rufen an]], [[riefen an]], [[rufen an]]

*Zu + Inf*: [[anzurufen]], *PII*: [[angerufen]]
Adjektive: [[anrufend]], [[anrufender]], [[anrufendst]]</agent_output>
</example>
<example>
<german_word>ständigen</german_word>
<agent_output>Adjektive: [[ständig]], [[ständiger]], [[ständigst]]</agent_output>
</example>

<example>
<german_word>zweiteres</german_word>
<agent_output>N: [[zwei]]  
A: [[zwei]]  
G: [[zweier]]  
D: [[zweien]]

---
📏 **Konjugierte Ordinalzahlen**  
N: [[zweite]], [[zweiter]], [[zweites]], [[zweiten]]  
A: [[zweiten]], [[zweiteren]], [[zweiten]]  
G: [[zweiten]], [[zweiterer]], [[zweiten]]  
D: [[zweitem]], [[zweiterem]], [[zweiten]]  
F: [[zweite]], [[zweitere]], [[zweiteste]]  
N: [[zweites]], [[zweiteres]], [[zweitestes]]  
P: [[zweiten]], [[zweiteren]], [[zweitesten]]  

---
📊 **Konjugierte Indefinitzahlen** *(if applicable)*  
(none for zwei)</agent_output>
</example>


<example>
<german_word>einzigsten</german_word>
<agent_output>N: [[ein]], [[eins]]  
A: [[ein]]  
G: [[eines]]  
D: [[einem]]  

---
📏 **Konjugierte Ordinalzahlen**  
N: [[erste]], [[erster]], [[erstes]], [[ersten]]  
A: [[ersten]], [[ersteren]], [[ersten]]  
G: [[ersten]], [[ersterer]], [[ersten]]  
D: [[erstem]], [[ersterem]], [[ersten]]  
F: [[erste]], [[erstere]], [[ersteste]]  
N: [[erstes]], [[ersteres]], [[erstestes]]  
P: [[ersten]], [[ersteren]], [[erstesten]]  

---
📊 **Konjugierte Indefinitzahlen**  
N: [[einige]], [[einer]], [[einziges]], [[einigen]]  
A: [[einigen]], [[einiger]], [[einzigsten]]  
G: [[einiger]], [[einigerer]], [[einzigster]]  
D: [[einigem]], [[einigerem]], [[einzigstem]]  
F: [[einige]], [[einige]], [[einzigste]]  
N: [[einiges]], [[einigeres]], [[einzigstes]]  
P: [[einigen]], [[einigeren]], [[einzigsten]]</agent_output>
</example>

<example>
<german_word>traurig</german_word>
<agent_output>Adjektive: [[traurig]], [[trauriger]], [[traurigst]]</agent_output>
</example>
<example>
<german_word>obwohl</german_word>
<agent_output>${LONG_DASH}</agent_output>
</example>
<example>
<german_word>Rechercheergbnisse</german_word>
<agent_output>N: das [[Rechercheergebenis]], die [[Rechercheergebnisse]]  
A: das [[Rechercheergbenis]], die [[Rechercheergebnisse]]  
G: des [[Rechercheergebnis­ses]], der [[Rechercheergebnisse]]  
D: dem [[Rechercheergebnis]], den [[Rechercheergebnissen]]</agent_output>
</example>

<example>
<german_word>her</german_word>
<agent_output>${LONG_DASH}</agent_output>
</example>

<example>
<german_word>verstopft</german_word>
<agent_output>Person, Präsens, Präteritum, Imperativ, KI, KII
ich, [[verstopf]] / [[verstopfe]], [[verstopfte]], [[verstopfe]], [[verstopfte]], ${LONG_DASH}
du, [[verstopfst]], [[verstopftest]], [[verstopfst]], [[verstopftest]], [[verstopf]] / [[verstopfe]]
er, [[verstopft]], [[verstopfte]], [[verstopfe]], [[verstopfte]], ${LONG_DASH}
wir, [[verstopfen]], [[verstopften]], [[verstopfen]], [[verstopften]], [[verstopfen]]
ihr, [[verstopft]], [[verstopftet]], [[verstopfet]], [[verstopftet]], [[verstopft]]
sie, [[verstopfen]], [[verstopften]], [[verstopfen]], [[verstopften]], [[verstopfen]]

*Zu + Inf*: zu [[verstopfen]], *PII*: [[verstopft]]
Adjektive: [[verstopfend]], [[verstopfender]], [[verstopfendst]]</agent_output>
</example>

<example>
<german_word>gehobener</german_word>
<agent_output>Adjektive: [[gehoben]], [[gehobener]], [[gehobenest]]</agent_output>
</example>

<example>
<german_word>Bank</german_word>
<agent_output>
N: die [[Bank]], die [[Banken]] | die [[Bank]], die [[Bänke]]  
A: die [[Bank]], die [[Banken]] | die [[Bank]], die [[Bänke]]  
G: der [[Bank]], der [[Banken]] | der [[Bank]], der [[Bänke]]  
D: der [[Bank]], den [[Banken]] | der [[Bank]], den [[Bänken]]
</agent_output>
</example>
<example>
<german_word>See</german_word>
<agent_output>
N: der [[See]], die [[Seen]] | die [[See]], ${LONG_DASH}  
A: den [[See]], die [[Seen]] | die [[See]], ${LONG_DASH}  
G: des [[Sees]], der [[Seen]] | der [[See]], ${LONG_DASH}  
D: dem [[See]], den [[Seen]] | der [[See]], ${LONG_DASH}
</agent_output>
</example>

<example>
<german_word>backen</german_word>
<agent_output>
ich, [[backe]], [[backte]], [[backe]], [[backte]], ${LONG_DASH}  
du, [[backst]], [[backtest]], [[backe]], [[backtest]], [[backe]]  
er, [[backt]], [[backte]], [[backe]], [[backte]], ${LONG_DASH}  
wir, [[backen]], [[backten]], [[backen]], [[backten]], [[backen]]  
ihr, [[backt]], [[backtet]], [[backt]], [[backtet]], [[backt]]  
sie, [[backen]], [[backten]], [[backen]], [[backten]], [[backen]]

*Zu + Inf*: zu [[backen]], *Partizip II*: [[gebackt]]

---
ich, [[backe]], [[buk]], [[backe]], [[buk]], ${LONG_DASH}  
du, [[backst]], [[bukst]], [[backe]], [[bukst]], [[backe]]  
er, [[backt]], [[buk]], [[backe]], [[buk]], ${LONG_DASH}  
wir, [[backen]], [[buken]], [[backen]], [[buken]], [[backen]]  
ihr, [[backt]], [[buket]], [[backt]], [[buket]], [[backt]]  
sie, [[backen]], [[buken]], [[backen]], [[buken]], [[backen]]

*Zu + Inf*: zu [[backen]], *Partizip II*: [[gebacken]]
Adjektive: [[gebacken]], [[gebackener]], [[gebackenst]]
</agent_output>
</example>
</examples>
`;
