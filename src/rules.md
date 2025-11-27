Purpose:
- link parts of TEXTS to ENTRIES

    
1. WORD is a combination of letters separated by spaces or ,.etc
2. LINK is an opearion LINK(str) -> str.md
3. Every WORD in a CORRECT german sentence CAN ONLY be LINKED to
   - ENTRIE.LEXEM
   - ENTRIE.INFLECTION

4. user can only LINK single words
5. SYSTEM can LINK a GROUP of multiple WORDS
6. GROUP of WORDS CAN ONLY be LINKED to
   - ENTRIE.LEXEM

ENTRIE.LEXEM is:
    - one-word
    - base form surface
    - with a unique POS
    - points to: MORPHEM, ENTRIE.LEXEM, ENTRIE.INFLECTION

ENTRIE.INFLECTION is:
    - one-word
    - inflected surface of a ENTRIE.LEXEM
    - points to: lexem

GRAMMAR_CONSTRUCTION


File structure:
Textfresser/
    Notes/
        xxx.md
        
    Texts/
        Texts.md
        .../.../xxx/
            xxx.md
            Page/
                0000-xxx.md
                0001-xxx.md
                ...
                9999-xxx.md

    Entrie/
        Grundform/
            a/
                abc/
                    abcdefg.md
                    ...
        Inflection/
            a/
                abc/
                    abcdefg.md
                    ...
