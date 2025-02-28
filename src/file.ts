import { Notice, TFile, Vault, normalizePath } from 'obsidian';

export class FileService {
    constructor(private vault: Vault) {}

    async appendToFile(filePath: string, text: string): Promise<void> {
        try {
            const normalizedPath = normalizePath(filePath);
            let abstractFile = await this.vault.getAbstractFileByPath(normalizedPath);

            if (!abstractFile || !(abstractFile instanceof TFile)) {
                // If the file doesn't exist, create it
                await this.vault.create(normalizedPath, '');
                abstractFile = await this.vault.getAbstractFileByPath(normalizedPath);

                if (!abstractFile || !(abstractFile instanceof TFile)) {
                    console.error(`Failed to create file "${normalizedPath}".`);
                    return;
                }
            }

            let fileContent = await this.vault.read(abstractFile);
            if (!fileContent.endsWith('\n')) {
                text = '\n' + text;
            }
            await this.vault.append(abstractFile, text);
        } catch (error) {
            console.error(`Failed to append to file ${filePath}: ${error}`);
            throw error;
        }
    }

    async doesFileContainContent(path: string, content: string): Promise<boolean | null> {
        try {
            const normalizedPath = normalizePath(path);
            const file = this.vault.getAbstractFileByPath(normalizedPath);
            
            if (!file || !(file instanceof TFile)) {
                return null;
            }

            const fileContent = await this.vault.read(file);
            return fileContent.includes(content);
        } catch (error) {
            console.error(`Failed to check file content ${path}: ${error}`);
            return null;
        }
    }
}
