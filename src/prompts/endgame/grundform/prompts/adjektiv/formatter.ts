import { Genus, Kasus, NomenDeklination, Numerus } from "prompts/endgame/zod/types";

type Form = {
    artikel: string;
    agj: string;
};

type CaseDeclension = {
    [Genus.M]: Form;
    [Genus.N]: Form;
    [Genus.F]: Form;
    [Numerus.Mehrzahl]: Form;
};

type Declensions = Record<Kasus, CaseDeclension>;
type AllDeclensions = Record<NomenDeklination, Declensions>;

export function makeAllDeclensionsFromAdjektivstamm(adjektivstamm: string): AllDeclensions {
    return {
        [NomenDeklination.Stark]: {
            [Kasus.N]: {
                [Genus.M]: { artikel: "", agj: `${adjektivstamm}er` },
                [Genus.N]:  { artikel: "", agj: `${adjektivstamm}es` },
                [Genus.F]:  { artikel: "", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "", agj: `${adjektivstamm}e` }
            },
            [Kasus.G]: {
                [Genus.M]: { artikel: "", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "", agj: `${adjektivstamm}en` },
                [Genus.F]:  { artikel: "", agj: `${adjektivstamm}er` },
                [Numerus.Mehrzahl]:   { artikel: "", agj: `${adjektivstamm}er` }
            },
            [Kasus.D]: {
                [Genus.M]: { artikel: "", agj: `${adjektivstamm}em` },
                [Genus.N]:  { artikel: "", agj: `${adjektivstamm}em` },
                [Genus.F]:  { artikel: "", agj: `${adjektivstamm}er` },
                [Numerus.Mehrzahl]:   { artikel: "", agj: `${adjektivstamm}en` }
            },
            [Kasus.A]: {
                [Genus.M]: { artikel: "", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "", agj: `${adjektivstamm}es` },
                [Genus.F]:  { artikel: "", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "", agj: `${adjektivstamm}e` }
            }
        },

        [NomenDeklination.Schwach]: {
            [Kasus.N]: {
                [Genus.M]: { artikel: "der", agj: `${adjektivstamm}e` },
                [Genus.N]:  { artikel: "das", agj: `${adjektivstamm}e` },
                [Genus.F]:  { artikel: "die", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "die", agj: `${adjektivstamm}en` }
            },
            [Kasus.G]: {
                [Genus.M]: { artikel: "des", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "des", agj: `${adjektivstamm}en` },
                [Genus.F]:  { artikel: "der", agj: `${adjektivstamm}en` },
                [Numerus.Mehrzahl]:   { artikel: "der", agj: `${adjektivstamm}en` }
            },
            [Kasus.D]: {
                [Genus.M]: { artikel: "dem", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "dem", agj: `${adjektivstamm}en` },
                [Genus.F]:  { artikel: "der", agj: `${adjektivstamm}en` },
                [Numerus.Mehrzahl]:   { artikel: "den", agj: `${adjektivstamm}en` }
            },
            [Kasus.A]: {
                [Genus.M]: { artikel: "den", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "das", agj: `${adjektivstamm}e` },
                [Genus.F]:  { artikel: "die", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "die", agj: `${adjektivstamm}en` }
            }
        },

        [NomenDeklination.Gemischt]: {
            [Kasus.N]: {
                [Genus.M]: { artikel: "ein", agj: `${adjektivstamm}er` },
                [Genus.N]:  { artikel: "ein", agj: `${adjektivstamm}es` },
                [Genus.F]:  { artikel: "eine", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "keine", agj: `${adjektivstamm}en` }
            },
            [Kasus.G]: {
                [Genus.M]: { artikel: "eines", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "eines", agj: `${adjektivstamm}en` },
                [Genus.F]:  { artikel: "einer", agj: `${adjektivstamm}en` },
                [Numerus.Mehrzahl]:   { artikel: "keiner", agj: `${adjektivstamm}en` }
            },
            [Kasus.D]: {
                [Genus.M]: { artikel: "einem", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "einem", agj: `${adjektivstamm}en` },
                [Genus.F]:  { artikel: "einer", agj: `${adjektivstamm}en` },
                [Numerus.Mehrzahl]:   { artikel: "keinen", agj: `${adjektivstamm}en` }
            },
            [Kasus.A]: {
                [Genus.M]: { artikel: "einen", agj: `${adjektivstamm}en` },
                [Genus.N]:  { artikel: "ein", agj: `${adjektivstamm}es` },
                [Genus.F]:  { artikel: "eine", agj: `${adjektivstamm}e` },
                [Numerus.Mehrzahl]:   { artikel: "keine", agj: `${adjektivstamm}en` }
            }
        }
    };
};

export function getSentencesForAllDeclensions(d: AllDeclensions): string[][] {
    // Fixed mappings for nouns per gender.
    const nouns: Record<keyof CaseDeclension, string[]> = {
      [Genus.M]: ["Vater", "Sohn", "Ding", "Onkel"],
      [Genus.F]: ["Mutter", "Tochter", "Sache", "Tante"],
      [Genus.N]: ["Kind", "Baby", "Geschenk", "Mädchen"],
      [Numerus.Mehrzahl]: ["Väter", "Töchter", "Geschenke", "Mutter"]
    };
  
    // Verb forms for the subject (nominative) by gender.
    const verbForms: Record<keyof CaseDeclension, string> = {
      [Genus.M]: "gibt",
      [Genus.F]: "gibt",
      [Genus.N]: "gibt",
      [Numerus.Mehrzahl]: "geben"
    };
  
    // Order of cases and genders.
    const cases: (keyof Declensions)[] = [Kasus.N, Kasus.D, Kasus.A, Kasus.G];
    const genders: (keyof CaseDeclension)[] = [Genus.M, Genus.F, Genus.N, Numerus.Mehrzahl];
  
    // Order of declension types.
    const declensionTypes: (keyof AllDeclensions)[] = [NomenDeklination.Stark, NomenDeklination.Schwach, NomenDeklination.Gemischt];
  
    // Outer array: one array of sentences per declension type.
    const sentences: string[][] = [];
  
    for (const dt of declensionTypes) {
      const sentencesForDeclension: string[] = genders.map(gender => {
        // Build each part of the sentence by case.
        // For each case, we combine:
        // 1. A fixed article (from the articles mapping)
        // 2. The adjective form from the declensions object
        // 3. A noun (from the nouns mapping)
        const parts = cases.map((cas, idx) => {
          const adj = d[dt][cas][gender].agj;
          const article = d[dt][cas][gender].agj
          const noun = nouns[gender][idx];
          const [firstLetter, ...rest] = adj;
          return article ? `*${article}* ${adj} *${noun}*` : `*${firstLetter.toUpperCase()}${rest.join('')}* ${adj} *${noun}*` ;
        });
  
        // The linking verb form is determined by the nominative gender.
        const verb = verbForms[gender];
  
        // Combine the parts into a sentence following the pattern:
        // "<Nom> [verb] <Dat> <Akk> <Gen>"
        return `${parts[0]} *${verb}* ${parts[1]} ${parts[2]} ${parts[3]}`;
      });
  
      sentences.push(sentencesForDeclension);
    }
  
    return sentences;
};
  
  // Example usage:
//   const allDeclensions = makeAllDeclensionsFromAdjektivstamm("wild"); // using the function f from the earlier example
//   const sentenceMatrix = getSentencesForAllDeclensions(allDeclensions);
//   console.log(sentenceMatrix);
