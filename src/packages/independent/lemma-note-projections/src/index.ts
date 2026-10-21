/**
 * `@textfresser/lemma-note-projections`: the projections the plugin derives
 * itself for its dictionary notes. Only Tags remain: inflection tables come
 * from the batteries' Inflection Packs, through the Lemma note codec's
 * `inflectionFromPack` (#120).
 */
export { deriveTags, readingTags, type TagInput } from "./tags";
