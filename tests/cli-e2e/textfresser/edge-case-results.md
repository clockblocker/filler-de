# Textfresser Edge Case Testing — Book of Work

## Test Environment
- **Date**: 2026-02-16
- **Vault**: cli-e2e-test-vault
- **Branch**: mb_restructure
- **Mode**: Real API (no stubs)

## Summary

| ID | Surface | Lemma OK | Wikilink | Entry Found | Notes |
|---|---|---|---|---|---|
| H1-A | Schloss | ✅ | ✅ | ✅ |  |
| H1-B | Schloss | ✅ | ✅ | ✅ |  |
| H1-C | Schloss | ✅ | ✅ | ✅ |  |
| H1-D | Bank | ✅ | ✅ | ✅ |  |
| H1-E | Bank | ✅ | ✅ | ✅ |  |
| H2-A | Essen | ✅ | ✅ | ✅ |  |
| H2-B | essen | ✅ | ✅ | ✅ |  |
| H2-C | Fliegen | ✅ | ✅ | ❌ |  |
| H2-D | fliegen | ✅ | ✅ | ✅ |  |
| H2-E | Lauf | ✅ | ✅ | ✅ |  |
| H2-F | laufen | ✅ | ✅ | ✅ |  |
| SV-A | macht | ✅ | ✅ | ✅ |  |
| SV-B | fängst | ✅ | ✅ | ❌ |  |
| SV-C | kauft | ✅ | ✅ | ❌ |  |
| SV-D | Pass | ✅ | ✅ | ❌ |  |
| SV-E | gibt | ✅ | ✅ | ❌ |  |
| SV-F | hört | ✅ | ✅ | ❌ |  |
| PH1-A | Auf keinen Fall | ✅ | ✅ | ❌ |  |
| PH1-B | Hals über Kopf | ✅ | ✅ | ❌ |  |
| PH1-C | in Ordnung | ✅ | ✅ | ✅ |  |
| PH1-D | ins Schwarze getroffen | ✅ | ✅ | ✅ |  |
| ADJ1-A | schön | ✅ | ✅ | ✅ |  |
| ADJ1-B | schöner | ✅ | ✅ | ❌ |  |
| ADJ1-C | klügste | ✅ | ✅ | ✅ |  |
| ADJ1-D | klüger | ✅ | ✅ | ❌ |  |

## Findings by Category

### H1: Homonym Nouns

#### H1-A: "Schloss" — New noun entry, castle sense

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:42 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Das alte [[Schloss]] thront über der Stadt. ^h1a
```

**Wikilink target**: `Schloss`

**Entry path**: `Worter/de/lexem/lemma/s/sch/schlo/Schloss.md`

**Entry content**:
```markdown
2026-02-16 12:32:43 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H1-B: "Schloss" — Disambiguation: same lemma+POS, DIFFERENT sense → new entry or matched?

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:44 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Er steckte den Schlüssel ins [[Schloss]]. ^h1b
```

**Wikilink target**: `Schloss`

**Entry path**: `Worter/de/lexem/lemma/s/sch/schlo/Schloss.md`

**Entry content**:
```markdown
2026-02-16 12:32:45 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H1-C: "Schloss" — Re-encounter: should match castle sense from H1-A

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:46 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Im [[Schloss]] gab es hundert Zimmer. ^h1c
```

**Wikilink target**: `Schloss`

**Entry path**: `Worter/de/lexem/lemma/s/sch/schlo/Schloss.md`

**Entry content**:
```markdown
2026-02-16 12:32:48 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar

🏰 das [[Schloss]], [ʃlɔs](https://youglish.com/pronounce/Schloss/german) ^LX-LM-NOUN-1


<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>
![[H1-A-schloss-castle#^h1a|^]]

<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>
= [[Burg]], [[Palast]] 
⊃ [[Gebäude]], [[Bauwerk]] 
⊂ [[Wasserschloss]], [[Jagdschloss]] 
∈ [[Turm]], [[Zinnen]], [[Mauern]] 

<span class="entry_section_title entry_section_title_translations">Übersetzung</span>
castle 

<span class="entry_section_title entry_section_title_morpheme">Morpheme</span>
[[Schloss]] 

<span class="entry_section_title entry_section_title_tags">Tags</span>
#noun/neutrum/common 

<span class="entry_section_title entry_section_title_flexion">Flexion</span>
N: das [[Schloss]], die [[Schlösser]] 
A: das [[Schloss]], die [[Schlösser]] 
G: des [[Schlosses]], der [[Schlösser]] 
D: dem [[Schloss]], den [[Schlössern]]



















<section id="textfresser_meta_keep_me_invisible">
{"entries":{"LX-LM-NOUN-1":{"entity":{"senseEmojis":["🏰"],"ipa":"ʃlɔs","language":"German","lemma":"Schloss","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma","features":{"inflectional":{},"lexical":{"pos":"Noun"}}},"senseEmojis":["🏰"]}},"noteKind":"DictEntry"}
</section>
```

---

#### H1-D: "Bank" — New noun, bench sense

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:49 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Die [[Bank]] am Fluss war nass vom Regen. ^h1d
```

**Wikilink target**: `Bank`

**Entry path**: `Worter/de/lexem/lemma/b/ban/bank/Bank.md`

**Entry content**:
```markdown
2026-02-16 12:32:50 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H1-E: "Bank" — Disambiguation: same lemma, different sense (die Bank)

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:51 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Sie hebt Geld bei der [[Bank]] ab. ^h1e
```

**Wikilink target**: `Bank`

**Entry path**: `Worter/de/lexem/lemma/b/ban/bank/Bank.md`

**Entry content**:
```markdown
2026-02-16 12:32:52 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

### H2: Cross-POS

#### H2-A: "Essen" — Noun (das Essen = food/meal)

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:53 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Das [[Essen]] im Restaurant war ausgezeichnet. ^h2a
```

**Wikilink target**: `Essen`

**Entry path**: `Worter/de/lexem/lemma/e/ess/essen/Essen.md`

**Entry content**:
```markdown
2026-02-16 12:32:54 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H2-B: "essen" — Verb (essen = to eat). Same lemma, different POS → separate entry

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:56 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Wir [[Essen|essen]] heute Abend zusammen. ^h2b
```

**Wikilink target**: `Essen`

**Entry path**: `Worter/de/lexem/lemma/e/ess/essen/Essen.md`

**Entry content**:
```markdown
2026-02-16 12:32:57 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H2-C: "Fliegen" — Noun plural (die Fliege). Lemma should resolve to Fliege

**Lemma**: OK

**Source after**:
```
2026-02-16 12:32:58 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Die [[Fliegen]] im Sommer sind lästig. ^h2c
```

**Wikilink target**: `Fliegen`

**Entry**: NOT FOUND at any path for target "Fliegen"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### H2-D: "fliegen" — Verb (fliegen = to fly). Different lemma from Fliege

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:00 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Wir [[fliegen]] morgen nach Berlin. ^h2d
```

**Wikilink target**: `fliegen`

**Entry path**: `Worter/de/lexem/lemma/f/fli/flieg/fliegen.md`

**Entry content**:
```markdown
2026-02-16 12:33:01 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H2-E: "Lauf" — Noun (der Lauf = course/run)

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:02 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Der [[Lauf]] des Flusses war ruhig. ^h2e
```

**Wikilink target**: `Lauf`

**Entry path**: `Worter/de/lexem/lemma/l/lau/lauf/Lauf.md`

**Entry content**:
```markdown
2026-02-16 12:33:03 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### H2-F: "laufen" — Verb. Lemma laufen ≠ noun Lauf? Or same?

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:04 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Die Kinder [[laufen]] schnell im Park. ^h2f
```

**Wikilink target**: `laufen`

**Entry path**: `Worter/de/lexem/lemma/l/lau/laufe/laufen.md`

**Entry content**:
```markdown
2026-02-16 12:33:05 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

### SV: Separable Verbs

#### SV-A: "macht" — Should detect "aufmachen" separable verb

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:06 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Er [[macht]] die Tür auf. ^v1a
```

**Wikilink target**: `macht`

**Entry path**: `Worter/de/lexem/lemma/m/mac/macht/macht.md`

**Entry content**:
```markdown
2026-02-16 12:33:07 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### SV-B: "fängst" — "anfangen", inflected stem + detached prefix

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:08 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Wann [[fängst]] du damit an? ^v1b
```

**Wikilink target**: `fängst`

**Entry**: NOT FOUND at any path for target "fängst"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### SV-C: "kauft" — "einkaufen"

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:11 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Sie [[kauft]] im Supermarkt ein. ^v1c
```

**Wikilink target**: `kauft`

**Entry**: NOT FOUND at any path for target "kauft"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### SV-D: "Pass" — "aufpassen" imperative — TWO "auf" in sentence!

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:13 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
[[Pass]] bitte auf die Kinder auf! ^v1d
```

**Wikilink target**: `Pass`

**Entry**: NOT FOUND at any path for target "Pass"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### SV-E: "gibt" — "zurückgeben"

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:15 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Er [[gibt]] das Buch morgen zurück. ^v1e
```

**Wikilink target**: `gibt`

**Entry**: NOT FOUND at any path for target "gibt"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### SV-F: "hört" — "aufhören"

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:17 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Sie [[hört]] mit dem Rauchen auf. ^v1f
```

**Wikilink target**: `hört`

**Entry**: NOT FOUND at any path for target "hört"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

### PH1: Phrasems / Multi-Word Expressions

#### PH1-A: "Auf keinen Fall" — Phrasem detection, multi-word selection

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:19 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
[[Auf keinen Fall]] mache ich das. ^ph1a
```

**Wikilink target**: `Auf keinen Fall`

**Entry**: NOT FOUND at any path for target "Auf keinen Fall"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### PH1-B: "Hals über Kopf" — Idiom phrasem

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:21 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Sie verließ [[Hals über Kopf]] das Haus. ^ph1b
```

**Wikilink target**: `Hals über Kopf`

**Entry**: NOT FOUND at any path for target "Hals über Kopf"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### PH1-C: "in Ordnung" — Common phrase

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:23 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Alles ist [[in Ordnung]]. ^ph1c
```

**Wikilink target**: `in Ordnung`

**Entry path**: `Worter/de/lexem/lemma/i/ino/inord/in Ordnung.md`

**Entry content**:
```markdown
2026-02-16 12:33:24 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### PH1-D: "ins Schwarze getroffen" — Idiom with inflected article

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:25 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Er hat [[ins Schwarze getroffen]]. ^ph1d
```

**Wikilink target**: `ins Schwarze getroffen`

**Entry path**: `Worter/de/lexem/lemma/i/ins/inssc/ins Schwarze getroffen.md`

**Entry content**:
```markdown
2026-02-16 12:33:26 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

### ADJ1: Adjective Forms & Propagation

#### ADJ1-A: "schön" — Adjective base form, new entry

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:27 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Das Wetter ist heute [[schön]]. ^adj1a
```

**Wikilink target**: `schön`

**Entry path**: `Worter/de/lexem/lemma/s/sch/schön/schön.md`

**Entry content**:
```markdown
2026-02-16 12:33:28 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### ADJ1-B: "schöner" — Comparative → lemma "schön", re-encounter or inflection propagation?

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:30 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Morgen wird es noch [[schöner]]. ^adj1b
```

**Wikilink target**: `schöner`

**Entry**: NOT FOUND at any path for target "schöner"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

#### ADJ1-C: "klügste" — Superlative → lemma "klug"

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:32 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Der [[klügste]] Schüler hat gewonnen. ^adj1c
```

**Wikilink target**: `klügste`

**Entry path**: `Worter/de/lexem/lemma/k/klü/klügs/klügste.md`

**Entry content**:
```markdown
2026-02-16 12:33:33 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
```

---

#### ADJ1-D: "klüger" — Comparative → re-encounter with klug from ADJ1-C

**Lemma**: OK

**Source after**:
```
2026-02-16 12:33:34 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Sie ist [[klüger]] als ihr Bruder. ^adj1d
```

**Wikilink target**: `klüger`

**Entry**: NOT FOUND at any path for target "klüger"

**Anomalies**:
- ⚠️ Wikilink exists but entry file not found

---

## Final Worter Tree

```
2026-02-16 12:33:35 Loading updated app package /Users/annagorelova/Library/Application Support/obsidian/obsidian-1.12.1.asar
Worter/de/lexem/inflected/a/abh/abheb/abheben.md
Worter/de/lexem/inflected/a/auf/aufhö/aufhören.md
Worter/de/lexem/inflected/a/auf/aufma/aufmachen.md
Worter/de/lexem/inflected/a/auf/aufpa/aufpassen.md
Worter/de/lexem/inflected/b/bän/bänke/Bänke.md
Worter/de/lexem/inflected/b/bän/bänke/Bänken.md
Worter/de/lexem/inflected/e/ein/einka/einkaufen.md
Worter/de/lexem/inflected/e/ess/essen/Essens.md
Worter/de/lexem/inflected/f/fli/flieg/Fliege.md
Worter/de/lexem/inflected/f/fli/flieg/Fliegen.md
Worter/de/lexem/inflected/k/klu/klug/klug.md
Worter/de/lexem/inflected/l/läu/läufe/Läufe.md
Worter/de/lexem/inflected/l/läu/läufe/Läufen.md
Worter/de/lexem/inflected/l/lau/laufe/Laufes.md
Worter/de/lexem/inflected/s/sch/schlö/Schlösser.md
Worter/de/lexem/inflected/s/sch/schlö/Schlössern.md
Worter/de/lexem/inflected/s/sch/schlo/Schlosses.md
Worter/de/lexem/inflected/z/zur/zurüc/zurückgeben.md
Worter/de/lexem/lemma/a/abb/abbre/abbrechen.md
Worter/de/lexem/lemma/a/ach/achte/achten.md
Worter/de/lexem/lemma/a/anf/anfan/anfangen.md
Worter/de/lexem/lemma/a/ang/angen/angenehm.md
Worter/de/lexem/lemma/a/aug/auge/Auge.md
Worter/de/lexem/lemma/b/ban/bank/Bank.md
Worter/de/lexem/lemma/b/bar/barge/bargeldlos zahlen.md
Worter/de/lexem/lemma/b/bau/bauwe/Bauwerk.md
Worter/de/lexem/lemma/b/bee/beend/beenden.md
Worter/de/lexem/lemma/b/beg/begin/beginnen.md
Worter/de/lexem/lemma/b/beh/behal/behalten.md
Worter/de/lexem/lemma/b/beh/behüt/behüten.md
Worter/de/lexem/lemma/b/bei/beibe/beibehalten.md
Worter/de/lexem/lemma/b/bei/bein/Bein.md
Worter/de/lexem/lemma/b/bei/beine/Beine.md
Worter/de/lexem/lemma/b/bes/besch/beschützen.md
Worter/de/lexem/lemma/b/bet/bett/Bett.md
Worter/de/lexem/lemma/b/bur/burg/Burg.md
Worter/de/lexem/lemma/e/eil/eilen/eilen.md
Worter/de/lexem/lemma/e/ein/einle/einleiten.md
Worter/de/lexem/lemma/e/ein/einsc/einschieben.md
Worter/de/lexem/lemma/e/ein/einza/einzahlen.md
Worter/de/lexem/lemma/e/ent/entne/entnehmen.md
Worter/de/lexem/lemma/e/ent/entri/entriegeln.md
Worter/de/lexem/lemma/e/erö/eröff/eröffnen.md
Worter/de/lexem/lemma/e/ers/ersta/erstatten.md
Worter/de/lexem/lemma/e/ess/essen/Essen.md
Worter/de/lexem/lemma/f/fah/fahre/fahren.md
Worter/de/lexem/lemma/f/fli/flieg/fliegen.md
Worter/de/lexem/lemma/f/flü/flüge/Flügel.md
Worter/de/lexem/lemma/f/flu/fluss/Flusslauf.md
Worter/de/lexem/lemma/f/fre/freun/freundlich.md
Worter/de/lexem/lemma/f/fru/fruch/Fruchtfliege.md
Worter/de/lexem/lemma/g/gar/garte/Garten.md
Worter/de/lexem/lemma/g/geb/gebäu/Gebäude.md
Worter/de/lexem/lemma/g/geh/gehen/gehen.md
Worter/de/lexem/lemma/g/ger/geric/Gericht.md
Worter/de/lexem/lemma/h/häs/hässl/hässlich.md
Worter/de/lexem/lemma/h/hau/haupt/Hauptspeise.md
Worter/de/lexem/lemma/h/her/herau/herausnehmen.md
Worter/de/lexem/lemma/h/her/herrl/herrlich.md
Worter/de/lexem/lemma/h/hoc/hocke/Hocker.md
Worter/de/lexem/lemma/i/ign/ignor/ignorieren.md
Worter/de/lexem/lemma/i/ins/insek/Insekt.md
Worter/de/lexem/lemma/j/jag/jagds/Jagdschloss.md
Worter/de/lexem/lemma/k/kop/kopf/Kopf.md
Worter/de/lexem/lemma/l/lan/lande/landen.md
Worter/de/lexem/lemma/l/lau/lauf/Lauf.md
Worter/de/lexem/lemma/l/lau/laufe/laufen.md
Worter/de/lexem/lemma/l/leh/lehne/Lehne.md
Worter/de/lexem/lemma/m/mah/mahlz/Mahlzeit.md
Worter/de/lexem/lemma/m/mau/mauer/Mauern.md
Worter/de/lexem/lemma/m/müc/mücke/Mücke.md
Worter/de/lexem/lemma/n/nac/nachs/Nachspeise.md
Worter/de/lexem/lemma/n/nah/nahru/Nahrung.md
Worter/de/lexem/lemma/ö/öff/öffne/öffnen.md
Worter/de/lexem/lemma/p/pal/palas/Palast.md
Worter/de/lexem/lemma/p/par/park/Park.md
Worter/de/lexem/lemma/p/pla/platz/Platz.md
Worter/de/lexem/lemma/r/rei/reise/reisen.md
Worter/de/lexem/lemma/r/ren/renne/rennen.md
Worter/de/lexem/lemma/r/rüc/rücke/rückerstatten.md
Worter/de/lexem/lemma/s/sch/schip/schippern.md
Worter/de/lexem/lemma/s/sch/schle/schlecht.md
Worter/de/lexem/lemma/s/sch/schli/schließen.md
Worter/de/lexem/lemma/s/sch/schlo/Schloss.md
Worter/de/lexem/lemma/s/sch/schna/Schnake.md
Worter/de/lexem/lemma/s/sch/schön/schön.md
Worter/de/lexem/lemma/s/seg/segel/segeln.md
Worter/de/lexem/lemma/s/sit/sitze/sitzen.md
Worter/de/lexem/lemma/s/sit/sitzf/Sitzfläche.md
Worter/de/lexem/lemma/s/sit/sitzg/Sitzgelegenheit.md
Worter/de/lexem/lemma/s/sor/sorge/sorgen.md
Worter/de/lexem/lemma/s/spa/spazi/spazieren.md
Worter/de/lexem/lemma/s/spe/speis/Speise.md
Worter/de/lexem/lemma/s/sta/start/starten.md
Worter/de/lexem/lemma/s/ste/stehe/stehen.md
Worter/de/lexem/lemma/s/sto/stopp/stoppen.md
Worter/de/lexem/lemma/s/str/strom/Strom.md
Worter/de/lexem/lemma/s/stu/stube/Stubenfliege.md
Worter/de/lexem/lemma/s/stu/stuhl/Stuhl.md
Worter/de/lexem/lemma/t/tie/tier/Tier.md
Worter/de/lexem/lemma/t/tra/traum/traumhaft.md
Worter/de/lexem/lemma/t/tur/turm/Turm.md
Worter/de/lexem/lemma/u/ufe/ufer/Ufer.md
Worter/de/lexem/lemma/u/una/unang/unangenehm.md
Worter/de/lexem/lemma/u/unt/unter/unterlassen.md
Worter/de/lexem/lemma/v/ver/verla/Verlauf.md
Worter/de/lexem/lemma/v/ver/verna/vernachlässigen.md
Worter/de/lexem/lemma/v/ver/verpf/Verpflegung.md
Worter/de/lexem/lemma/v/vor/vorsp/Vorspeise.md
Worter/de/lexem/lemma/w/was/wasse/Wasser.md
Worter/de/lexem/lemma/w/was/wasse/Wasserlauf.md
Worter/de/lexem/lemma/w/was/wasse/Wasserschloss.md
Worter/de/lexem/lemma/w/wun/wunde/wunderschön.md
Worter/de/lexem/lemma/z/zin/zinne/Zinnen.md
Worter/de/lexem/lemma/z/zum/zumac/zumachen.md
Worter/de/morphem/lemma/e/en/en/en.md
Worter/de/morphem/lemma/f/fan/fange/fangen.md
Worter/de/morphem/lemma/g/geb/geben/geben.md
Worter/de/morphem/lemma/h/heb/heben/heben.md
Worter/de/morphem/lemma/h/hör/hören/hören.md
Worter/de/morphem/lemma/m/mac/mache/machen.md
Worter/de/morphem/lemma/p/pas/passe/passen.md
Worter/de/phrasem/inflected/i/ins/inssc/ins Schwarze treffen.md
Worter/de/phrasem/lemma/a/auf/aufke/auf keinen Fall.md
Worter/de/phrasem/lemma/b/bes/beste/bestens.md
Worter/de/phrasem/lemma/e/ein/einwa/einwandfrei.md
Worter/de/phrasem/lemma/e/erf/erfol/erfolgreich sein.md
Worter/de/phrasem/lemma/f/fal/falsc/falsch liegen.md
Worter/de/phrasem/lemma/f/feh/fehle/fehlerhaft.md
Worter/de/phrasem/lemma/g/gel/gelin/gelingen.md
Worter/de/phrasem/lemma/g/ges/gestö/gestört.md
Worter/de/phrasem/lemma/g/gut/gut/gut.md
Worter/de/phrasem/lemma/h/hal/halsü/hals über kopf.md
Worter/de/phrasem/lemma/i/ino/inord/in Ordnung.md
Worter/de/phrasem/lemma/k/kap/kaput/kaputt.md
Worter/de/phrasem/lemma/k/kor/korre/korrekt.md
Worter/de/phrasem/lemma/p/pri/prima/prima.md
Worter/de/phrasem/lemma/r/rec/recht/recht haben.md
Worter/de/phrasem/lemma/r/ric/richt/richtig liegen.md
Worter/de/phrasem/lemma/r/ric/richt/richtig.md
Worter/de/phrasem/lemma/s/sch/schei/scheitern.md
```

## Proposed Improvements

_To be filled after analysis of results above._

## Priority Ranking

| # | Improvement | Impact | Effort | Priority |
|---|---|---|---|---|
| | | | | |
