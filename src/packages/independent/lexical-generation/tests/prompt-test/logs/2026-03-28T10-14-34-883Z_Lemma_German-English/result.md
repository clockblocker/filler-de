# Prompt Test: Lemma (German → English)
**Model**: gemini-2.5-flash-lite | **Date**: 2026-03-28T10:14:34.883Z

**Summary**: 4/8 match expected | 8/8 schema valid

## Example 1
**Input**: `{"context":"Sie [fängt] morgen mit der Arbeit an","surface":"fängt"}`
**Expected**: `{"contextWithLinkedParts":"Sie [fängt] morgen mit der Arbeit [an]","lemma":"anfangen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Sie [fängt] morgen mit der Arbeit [an]","lemma":"anfangen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 700ms

## Example 2
**Input**: `{"context":"Sie [kauft] im Supermarkt ein.","surface":"kauft"}`
**Expected**: `{"contextWithLinkedParts":"Sie [kauft] im Supermarkt [ein].","lemma":"einkaufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Sie [kauft] im Supermarkt [ein].","lemma":"einkaufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 630ms

## Example 3
**Input**: `{"context":"Er [rief] seine Mutter an","surface":"rief"}`
**Expected**: `{"contextWithLinkedParts":"Er [rief] seine Mutter [an]","lemma":"anrufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Er [rief] seine Mutter [an]","lemma":"anrufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 605ms

## Example 4
**Input**: `{"context":"Mir ist [aufgefallen], dass er nicht da war.","surface":"aufgefallen"}`
**Expected**: `{"lemma":"auffallen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Mir ist [aufgefallen], dass er nicht da war.","lemma":"auffallen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ❌
**Duration**: 614ms

## Example 5
**Input**: `{"context":"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.","surface":"besaßen"}`
**Expected**: `{"lemma":"besitzen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":null,"lemma":"besitzen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ❌
**Duration**: 717ms

## Example 6
**Input**: `{"context":"Die Dursleys besaßen alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte [Sorge].","surface":"Sorge"}`
**Expected**: `{"lemma":"Sorge","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma"}`
**Actual**: `{"contextWithLinkedParts":null,"lemma":"Sorge","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma"}`
**Schema valid**: ✅ | **Matches expected**: ❌
**Duration**: 631ms

## Example 7
**Input**: `{"context":"Zu ihrer Schwester Greta sagt sie: „Drück mir bitte die [Daumen], dass alles gut geht!“","surface":"Daumen"}`
**Expected**: `{"contextWithLinkedParts":"Zu ihrer Schwester Greta sagt sie: „[Drück] mir bitte [die] [Daumen], dass alles gut geht!“","lemma":"die Daumen drücken","linguisticUnit":"Phrasem","posLikeKind":"Idiom","surfaceKind":"Partial"}`
**Actual**: `{"contextWithLinkedParts":"Zu ihrer Schwester Greta sagt sie: „Drück mir bitte die [Daumen], dass alles gut geht!“","lemma":"Daumen","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma"}`
**Schema valid**: ✅ | **Matches expected**: ❌
**Duration**: 579ms

## Example 8
**Input**: `{"context":"Ich [drehe] den Wasserhahn zu","surface":"drehe"}`
**Expected**: `{"contextWithLinkedParts":"Ich [drehe] den Wasserhahn [zu]","lemma":"zudrehen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Ich [drehe] den Wasserhahn [zu]","lemma":"zudrehen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 573ms
