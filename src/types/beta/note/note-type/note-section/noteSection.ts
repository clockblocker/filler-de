type NoteSectionObject<F extends Record<string, any>> = {
  fields: F;
  modifiable: boolean;
  fieldsFromMd: (s: string) => F;
  mdFromMdFields: (s: F) => string;
  merge: (othersFields: F) => F;
};
