import { z } from "zod";
import { TEXT, ENTRIE, NOTE, ROOT } from "../../types/beta/literals";

export const MetaInfoSchema = z.object({
    fileType: z.enum([TEXT, ENTRIE, NOTE, ROOT]),
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
