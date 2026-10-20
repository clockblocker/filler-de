// One import per battery package, plus `dumdict/schema` so the bundle holds
// zod. The smoke test runs this module and bundles it with the plugin's build
// flags, so a broken link fails `test:unit`.
import { canonicalJson } from "common-utils";
import { checkIfGrundform } from "dumcorpus/inventories";
import { parseAsLemmaRecord } from "dumdict";
import { lemmaRecordSchema } from "dumdict/schema";
import { createDumgen } from "dumgen";
import { normalizeForm } from "dumling";
import { parseReadingKnowledge } from "dumrel";

export const batteryExports = {
	"common-utils": canonicalJson,
	dumcorpus: checkIfGrundform,
	dumdict: parseAsLemmaRecord,
	dumgen: createDumgen,
	dumling: normalizeForm,
	dumrel: parseReadingKnowledge,
} as const;

export const batterySchemas = { lemmaRecordSchema } as const;
