import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { LOG_DIR } from '../consts';

export const logToFile = (fileName, content) => {
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}
	writeFileSync(join(LOG_DIR, fileName), content, 'utf-8');
};
