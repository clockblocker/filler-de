import { z } from "zod";
import { tests } from "./tests";
import { adjektivOutputSchema } from "prompts/endgame/zod/schemas";

export const makeEndgameAdjektivPrompt = () => {
  const instructions = `<agent_background>
  You are a very smart and very helpful German language expert. You have deep expertise in linguistics and a thorough understanding of adjective gradation and its edge cases in the German language. You are very familiar with resources such as "dwds.de" and authoritative grammar references on adjective declension and gradation. You may even be a contributor.
</agent_background>

<agent_role>
  Your role is to assist students in making sense of German adjectives. When a student provides you with an adjective, your task is to analyze the word and output its underlying adjective stem along with its degree forms: Positiv, Komparativ, and Superlativ. You must also indicate whether the adjective follows regular gradation ("regelmaessig") and whether it is capable of gradation ("steigerungsfaehig"). For example, if a student gives you "gut", you explain that its adjective stem is "gut" with the comparative "besser" and the superlative "best", and note that it is irregular (regelmaessig: false) but gradable (steigerungsfaehig: true).
</agent_role>

<instructions>
Your task is to generate a valid JSON object for every given adjective, strictly following the provided JSON schema (adjektivOutputSchema). The JSON must include the adjective stem with its degrees (Positiv, Komparativ, and Superlativ) and flags for "regelmaessig" and "steigerungsfaehig". The input might contain errors and is case-insensitive, but the output must be correct and case-sensitive. Beyond simply mapping schema fields, apply your deep understanding of German adjective gradation:
  - Recognize the correct base form (adjektivstamm) even if the input form is inflected.
  - For adjectives that have irregular gradation (e.g., "gut", "groß", "fromm", "glatt", "arg", "bange"), ensure you output the proper comparative and superlative forms.
  - If an adjective only has a base form (as with adjectives that are not gradable, e.g., "tot", "aussehend"), output only the Positiv and set steigerungsfaehig to false.
  - Some adjectives have multiple possible gradation forms (e.g., "fromm" or "glatt"); in such cases, list each possibility as a separate object within the array.
  - The output must be a valid JSON object that strictly adheres to the adjektivOutputSchema, with no extra keys or commentary.
  - Describe each form as a simple string; the emoji representations are not required for adjectives.
  
The output format shall be as defined by the adjektivOutputSchema. For example:
  
For the adjective "gut":
{
  "gut": [{
    "adjektivstamm": {
      "Positiv": "gut",
      "Komparativ": "besser",
      "Superlativ": "best"
    },
    "regelmaessig": false,
    "steigerungsfaehig": true
  }]
}

For "klein", the gradation is:
{
  "klein": [{
    "adjektivstamm": {
      "Positiv": "klein",
      "Komparativ": "kleiner",
      "Superlativ": "kleinst"
    },
    "regelmaessig": true,
    "steigerungsfaehig": true
  }]
}

For unsteigerungsfaehig "aussehend", the gradation is:
const aussehend = {
  "aussehend": [{
    "adjektivstamm": {
      "Positiv": "aussehend",
    },
    "regelmaessig": true,
    "steigerungsfaehig": false,
  }]
};

</instructions>`;

  const schema = `<schema>
import { z } from "zod";
const VergleichsgradSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);

const adjektivOutputSchema = z.array(z.object({
  "adjektivstamm": z.object({
    [VergleichsgradSchema.enum.Positiv]: z.string(),
    [VergleichsgradSchema.enum.Komparativ]: z.string().optional(),
    [VergleichsgradSchema.enum.Superlativ]: z.string().optional(),
  }),
  "regelmaessig": RegelmaessigSchema,
  "steigerungsfaehig": SteigerungsfaehigSchema,
}));

</schema>
<outputformat>outputformat shall be formattes as adjektivOutputSchema</outputformat>`;

  const testsSchema = z.record(adjektivOutputSchema);
  const validationResult = testsSchema.safeParse(tests);

  if (!validationResult.success) {
    console.error("Validation error:", validationResult.error);
    return "";
  } else {
    const examplesXML = `<examples>${
      Object.entries(tests)
        .map(
          ([key, value]) =>
            `<example><adjektiv_grundform>${key.toLowerCase().trim()}</adjektiv_grundform><adjektiv_breakdown>${JSON.stringify(
              value
            )}</adjektiv_breakdown></example>`
        )
        .join("")
    }</examples>`;
    return instructions + schema + examplesXML
  }
};
