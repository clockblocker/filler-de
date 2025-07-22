import z from 'zod/v4';

const PlusDelimeterSchema = z.literal('_plus_');
export type PlusDelimeter = z.infer<typeof PlusDelimeterSchema>;
export const PLUS_DELIMETER = PlusDelimeterSchema.value;
