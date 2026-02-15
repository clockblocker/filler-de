import { z } from "zod";

export const ReadSchema = z.literal("Read");
export type READ = z.infer<typeof ReadSchema>;
export const READ = ReadSchema.value;
