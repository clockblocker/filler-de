import { z } from "zod/v3";

const personValues = ["0", "1", "2", "3", "4"] as const;

// Source: https://universaldependencies.org/u/feat/Person.html
export const Person = z.enum(personValues);
export type Person = z.infer<typeof Person>;
export const PERSON_KEY = "person";

const reprForPerson = {
	"0": "zero",
	"1": "first",
	"2": "second",
	"3": "third",
	"4": "fourth",
} satisfies Record<Person, string>;

export function getReprForPerson(person: Person) {
	return reprForPerson[person];
}
