1. WORD is a combination of letters separated by spaces or ,.etc
2. LINK is an opearion LINK(str) -> str.md
3. Every WORD in a CORRECT german sentence CAN be LINKED to

- either LEXEM
- or INFLECTION

4. user can only LINK single words
5. SYSTEM can LINK a GROUP of multiple WORDS

LEXEM is

- one-word
- base form surface
- with a unique POS
- points to: MORPHEM, LEXEM, INFLECTION

INFLECTION is

- one-word
- inflected surface of a LEXEM
- points to: lexem

GRAMMAR_CONSTRUCTION

-

PHRASEM

['pass']

[
{surf: "Sie"},
{surf: "hat", member: "hilfsVerb"},
{surf: "das"},
{surf: "Fenster"},
["geschlossen", {member: "mainVerb"}]
]


ValencyFrames: {}