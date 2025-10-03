import { z } from 'zod';
import { TEXT_ROOT, ENTRIE, NOTE, ROOT, PAGE } from '../../types/beta/literals';

export const MetaInfoSchema = z.object({
	fileType: z.enum([PAGE, ENTRIE, NOTE, ROOT, TEXT_ROOT]),
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
