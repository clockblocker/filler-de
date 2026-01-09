import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { LOG_DIR } from '../consts';

const logToFile = (fileName: string, content: string) => {
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}
	writeFileSync(join(LOG_DIR, fileName), content, 'utf-8');
};

export default logToFile;