import { z } from "zod/v3";

const caseValues = [
	"Abe",
	"Ben",
	"Cau",
	"Cmp",
	"Cns",
	"Com",
	"Dat",
	"Dis",
	"Equ",
	"Gen",
	"Ins",
	"Par",
	"Tem",
	"Abl",
	"Add",
	"Ade",
	"All",
	"Del",
	"Ela",
	"Ess",
	"Ill",
	"Ine",
	"Lat",
	"Loc",
	"Per",
	"Sbe",
	"Sbl",
	"Spl",
	"Sub",
	"Sup",
	"Ter",
] as const;

// Source: https://universaldependencies.org/u/feat/Case.html
export const Case = z.enum(caseValues);
export type Case = z.infer<typeof Case>;

const caseRepr = {
	Abe: "abessive / caritive / privative",
	Ben: "benefactive / destinative",
	Cau: "causative / motivative / purposive",
	Cmp: "comparative",
	Cns: "considerative",
	Com: "comitative / associative",
	Dat: "dative",
	Dis: "distributive",
	Equ: "equative",
	Gen: "genitive",
	Ins: "instrumental / instructive",
	Par: "partitive",
	Tem: "temporal",
	Abl: "ablative / adelative",
	Add: "additive",
	Ade: "adessive",
	All: "allative / adlative",
	Del: "delative / superelative",
	Ela: "elative / inelative",
	Ess: "essive / prolative",
	Ill: "illative / inlative",
	Ine: "inessive",
	Lat: "lative / directional allative",
	Loc: "locative",
	Per: "perlative",
	Sbe: "subelative",
	Sbl: "sublative",
	Spl: "superlative",
	Sub: "subessive",
	Sup: "superessive",
	Ter: "terminative / terminal allative",
} satisfies Record<Case, string>;

export function reprForCase(caseValue: Case) {
	return caseRepr[caseValue];
}
