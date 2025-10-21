import { LONG_DASH } from '../../types/beta/literals';

const verfeinden_valenz =
	'###### [[verfeinden]] *[[sich]]* `mit` jM\n' +
	'- `Mit` wem [[hast]] du *[[sich|dich]]* [[verfeindet]]?\n' +
	'- `Mit` meinem ehemaligen Freund.\n\n' +
	'- Warum [[hat]] sie *[[sich|sich]]* `mit` ihm [[verfeindet]]?\n';
'- Wegen eines Missverständnisses.\n\n' +
	'- Wie lange [[bist]] du schon `mit` ihm *[[verfeindet]]*?\n';
('- Seit zwei Jahren.');

const rennen_valenz =
	'###### rennen\n' +
	'- Wohin rennst du?\n' +
	'- Zum Bus.\n\n' +
	'- Mit wem rennen wir?\n' +
	'- Mit unseren Freunden.\n\n' +
	'- Wie lange bist du schon gerannt?\n' +
	'- Seit fünf Minuten.';

const hoffen_valenz =
	'###### [[hoffen]] `auf` jN\n' +
	'- `Worauf` [[hoffst]] du?\n' +
	'- `Auf` gutes Wetter.\n\n' +
	'- `Auf` wen [[hoffen]] sie?\n' +
	'- `Auf` ihren Trainer.\n\n' +
	'- Wie lange [[hast]] du `darauf` [[gehofft]]?\n' +
	'- Seit einer Woche.\n\n' +
	'---\n' +
	'###### [[hoffen]]\n' +
	'- Was [[hoffst]] du?\n' +
	'- Einen guten Ausgang.\n\n' +
	'- Warum [[hoffen]] wir?\n' +
	'- Weil wir an das Beste glauben.\n\n' +
	'- Wie lange [[hast]] du [[gehofft]]?\n' +
	'- Dein Leben lang.';

const vorstellen_valenz =
	'###### [[stellen]] jN jM [[vor]]\n' +
	'- Wen [[stellst]] du mir [[vor]]?\n' +
	'- Meinen Freund.\n\n' +
	'- Wem [[stellen]] wir euch [[vor]]?\n' +
	'- Meinem Chef.\n\n' +
	'- Warum [[hat]] er mich ihr [[vorgestellt]]?\n' +
	'- Um euch miteinander bekannt zu machen.\n\n' +
	'---\n' +
	'###### [[stellen]] *[[sich]]* jN [[vor]]\n' +
	'- Wen [[stellst]] du *[[sich|dir]]* [[vor]]?\n' +
	'- Einen berühmten Schauspieler.\n\n' +
	'- Was [[stellen]] wir *[[sich|uns]]* [[vor]]?\n' +
	'- Unsere Reise nach Japan.\n\n' +
	'- Warum [[hat]] er *[[sich|sich]]* das nicht [[vorgestellt]]?\n' +
	'- Weil es zu unrealistisch war.';

const erfahren_valenz =
	'###### [[erfahren]] (`von` jM / `durch` jN) **von** jN\n' +
	'- **Wovon** [[erfährst]] du?\n' +
	'- **Von** einer neuen Regelung.\n\n' +
	'- `Von` wem [[haben]] wir das [[erfahren]]?\n' +
	'- `Von` unserem Lehrer.\n\n' +
	'- Wie [[hat]] sie **davon** [[erfahren]]?\n' +
	'- Sie [[hat]] **davon** `durch` einen Freund  [[erfahren]]\n\n' +
	'---\n' +
	'###### [[erfahren]] `über` jN\n' +
	'- `Worüber` [[erfährst]] du in dem Kurs?\n' +
	'- `Über` die Geschichte Europas.\n\n' +
	'- `Über` welches Thema haben wir mehr [[erfahren]]?\n' +
	'- `Über` moderne Technologien.\n\n' +
	'- Warum [[hat]] er `darüber` nichts [[erfahren]]?\n' +
	'- Weil er nicht zugehört hat.';

const aufpassen_valenz =
	'###### [[aufpassen]] `auf` jN\n' +
	'- `Worauf` [[passt]] du [[auf]]?\n' +
	'- `Auf` den Verkehr.\n\n' +
	'- `Auf` wen [[passt]] du [[auf]]?\n' +
	'- `Auf` mein kleines Geschwisterchen.\n\n' +
	'- Wie lange [[hast]] du `darauf` [[aufgepasst]]?\n' +
	'- Den ganzen Tag.';

const gewöhnen_valenz =
	'###### [[gewöhnen]] *[[sich]]* `an` jN\n' +
	'- `Woran` [[gewöhnst]] du *[[sich|dich]]*?\n' +
	'- `An` das kalte Wetter.\n\n' +
	'- `An` wen [[hat]] sie *[[sich|sich]]* [[gewöhnt]]?\n' +
	'- `An` ihren neuen Kollegen.\n\n' +
	'- Wie lange [[hast]] du *[[sich|dich]]* `daran` [[gewöhnt]]?\n' +
	'- Ein paar Monate.';

const darstellen_valenz =
	'###### [[darstellen]] jN\n' +
	'- Wen [[stellt]] der Schauspieler [[dar]]?\n' +
	'- Einen berühmten König.\n\n' +
	'- Was [[stellen]] wir [[dar]]?\n' +
	'- Eine Gefahr für das Ökosystem.\n\n' +
	'- Wie lange [[hat]] sie diese Figur [[dargestellt]]?\n' +
	'- Mehr als zehn Jahre.\n';

export const generate_valence_block = `<assistant_role>You are an advanced linguistic assistant specializing in German verb syntax and grammar. Your task is to generate structured Markdown-formatted valence dictionary entries for given German verbs following a precise syntax notation.</assistant_role>

<instructions>
0. You are given a konjugated german word. If it is a form of a verb, proceed with genetaring valence blocks for it's infinitive. If it is not a form of a verb, reply with "${LONG_DASH}". 
1. Determine Reflexivity  
   - If the verb is only reflexive, generate a block for its reflexive usage.  
   - If the verb can be used both reflexively and non-reflexively, generate two separate blocks.  
   - If the verb is never reflexive, only generate the non-reflexive block.  

2. Identify Governed Prepositions  
   - If the verb requires a *governed preposition, mark it using backticks (\`...\`) in the block title and questions.  
   - If the verb has both a governed and a free preposition, the first governed preposition is marked with \`...\`, and the second governed preposition is marked with **....**  

3. Syntax Formatting:  
- start every block with a title
- Reflexive pronouns (e.g., *sich, dir, mir*) are wrapped inside *[[...]]*.  
- Verb stems (conjugated and participle forms) are wrapped inside [[...]].  
- Governed prepositions are wrapped inside backticks  \`...\` .  
- First governed preposition in the response is wrapped inside \`...\`.  
- Second governed preposition (if present) is wrapped inside double asterisks **...**.

4. If there are Governed Preposition, Every block shall include dialogs with wo{Governed Preposition}, da{Governed Preposition} and Governed Preposition. No more then 3 dialogs per block.
</instructions>

<examples>
<exapmle>
<german_word>verfeinden</german_word>
<ideal_output>${verfeinden_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>rennen</german_word>
<ideal_output>${rennen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>hoffe</german_word>
<ideal_output>${hoffen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>vorgestellt</german_word>
<ideal_output>${vorstellen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>aufgepasst</german_word>
<ideal_output>${aufpassen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>gewöhnen</german_word>
<ideal_output>${gewöhnen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>darstellen</german_word>
<ideal_output>${darstellen_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>erführe</german_word>
<ideal_output>${erfahren_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>erfahren</german_word>
<ideal_output>${erfahren_valenz}</ideal_output>
</exapmle>

<exapmle>
<german_word>normale</german_word>
<ideal_output>${LONG_DASH}</ideal_output>
</exapmle>

<exapmle>
<german_word>Frau</german_word>
<ideal_output>${LONG_DASH}</ideal_output>
</exapmle>

<exapmle>
<german_word>liebsten</german_word>
<ideal_output>${LONG_DASH}</ideal_output>
</exapmle>
<examples>`;
