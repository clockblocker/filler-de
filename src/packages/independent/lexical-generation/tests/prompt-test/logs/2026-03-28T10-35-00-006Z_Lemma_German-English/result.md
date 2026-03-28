# Prompt Test: Lemma (German → English)
**Model**: gemini-2.5-flash-lite | **Date**: 2026-03-28T10:35:00.006Z

**Summary**: 7/8 match expected | 7/8 schema valid

## Example 1
**Input**: `{"context":"Sie [fängt] morgen mit der Arbeit an","surface":"fängt"}`
**Expected**: `{"contextWithLinkedParts":"Sie [fängt] morgen mit der Arbeit [an]","lemma":"anfangen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Sie [fängt] morgen mit der Arbeit [an]","lemma":"anfangen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 699ms

## Example 2
**Input**: `{"context":"Sie [kauft] im Supermarkt ein.","surface":"kauft"}`
**Expected**: `{"contextWithLinkedParts":"Sie [kauft] im Supermarkt [ein].","lemma":"einkaufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Sie [kauft] im Supermarkt [ein].","lemma":"einkaufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 556ms

## Example 3
**Input**: `{"context":"Er [rief] seine Mutter an","surface":"rief"}`
**Expected**: `{"contextWithLinkedParts":"Er [rief] seine Mutter [an]","lemma":"anrufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Er [rief] seine Mutter [an]","lemma":"anrufen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 567ms

## Example 4
**Input**: `{"context":"Mir ist [aufgefallen], dass er nicht da war.","surface":"aufgefallen"}`
**Expected**: `{"contextWithLinkedParts":"Mir ist [aufgefallen], dass er nicht da war.","lemma":"auffallen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Mir ist [aufgefallen], dass er nicht da war.","lemma":"auffallen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 661ms

## Example 5
**Input**: `{"context":"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.","surface":"besaßen"}`
**Expected**: `{"contextWithLinkedParts":"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.","lemma":"besitzen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.","lemma":"besitzen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 772ms

## Example 6
**Input**: `{"context":"Die Dursleys besaßen alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte [Sorge].","surface":"Sorge"}`
**Expected**: `{"contextWithLinkedParts":"Die Dursleys besaßen alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte [Sorge].","lemma":"Sorge","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma"}`
**Actual**: `null`
**Schema valid**: ❌ | **Matches expected**: ❌
**Duration**: 717ms
**Error**: JSON Parse error: Unrecognized token '<'

## Example 7
**Input**: `{"context":"„Du bekommst ja dein Budget. Und jetzt hör auf, mir Honig um den Bart zu [schmieren].","surface":"schmieren"}`
**Expected**: `{"contextWithLinkedParts":"„Du bekommst ja dein Budget. Und jetzt hör auf, mir [Honig] um den [Bart] zu [schmieren].","lemma":"Honig um den Bart schmieren","linguisticUnit":"Phrasem","posLikeKind":"Idiom","surfaceKind":"Partial"}`
**Actual**: `{"contextWithLinkedParts":"„Du bekommst ja dein Budget. Und jetzt hör auf, mir [Honig] um den [Bart] zu [schmieren].","lemma":"Honig um den Bart schmieren","linguisticUnit":"Phrasem","posLikeKind":"Idiom","surfaceKind":"Partial"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 757ms

## Example 8
**Input**: `{"context":"Ich [drehe] den Wasserhahn zu","surface":"drehe"}`
**Expected**: `{"contextWithLinkedParts":"Ich [drehe] den Wasserhahn [zu]","lemma":"zudrehen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Actual**: `{"contextWithLinkedParts":"Ich [drehe] den Wasserhahn [zu]","lemma":"zudrehen","linguisticUnit":"Lexem","posLikeKind":"Verb","surfaceKind":"Inflected"}`
**Schema valid**: ✅ | **Matches expected**: ✅
**Duration**: 582ms
