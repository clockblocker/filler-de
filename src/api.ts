import { GoogleGenerativeAI, GenerationConfig, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { TextEaterSettings } from "./types";
import { TFile, Vault, Notice, TAbstractFile } from 'obsidian';
import { prompts } from './prompts';

export class ApiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model = "gemini-2.0-flash-lite";
    private logFile = "api-logs.md";
    private chatSessions: { [key: string]: any } = {};

    constructor(private settings: TextEaterSettings, private vault: Vault) {
        try {
            if (this.settings.apiProvider === 'deepseek') {
                // No initialization needed here
            } else if (this.settings.apiProvider === 'google') {
                this.genAI = new GoogleGenerativeAI(this.settings.googleApiKey);
            }
            this.ensureLogFile();
        } catch (error) {
            new Notice(`Error initializing API service: ${error.message}`);
        }
    }

    private async ensureLogFile() {
        try {
            if (!(await this.vault.adapter.exists(this.logFile))) {
                await this.vault.create(this.logFile, "# API Logs\n\n");
            }
        } catch (error) {
            console.error('Error creating log file:', error);
        }
    }

    private async appendToLog(systemPrompt: string, response: string, error?: any) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `
                ## ${timestamp}
                ### Prompt:
                \`\`\`
                ${systemPrompt}
                \`\`\`

                ### Response:
                \`\`\`
                ${response}
                \`\`\`
                ${error ? `\n### Error:\n\`\`\`\n${JSON.stringify(error, null, 2)}\n\`\`\`\n` : ''}
                ---
                `;

            const abstractFile = this.vault.getAbstractFileByPath(this.logFile);
            if (abstractFile instanceof TFile) {
                const currentContent = await this.vault.read(abstractFile);
                await this.vault.modify(abstractFile, currentContent + logEntry);
            } else {
                await this.ensureLogFile();
                const newFile = this.vault.getAbstractFileByPath(this.logFile);
                if (newFile instanceof TFile) {
                    await this.vault.modify(newFile, logEntry);
                }
            }
        } catch (error) {
            console.error('Error appending to log:', error);
        }
    }

    private async generateContent(systemPrompt: string, userInput: string): Promise<string> {
        try {
            let response: string | null = null;
            // Remove leading tab characters from the system prompt
            systemPrompt = systemPrompt.replace(/^\t+/gm, '');

            if (this.settings.apiProvider === 'deepseek') {
                if (!this.settings.deepseekApiKey) {
                    throw new Error('DeepSeek API key not configured.');
                }

                const url = 'https://api.deepseek.com/v1/generation/inference';
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.deepseekApiKey}`
                };
                const deepseekData = {
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userInput
                        }
                    ],
                    stream: false,
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(deepseekData)
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const deepseekResponse = await res.json();
                response = deepseekResponse.choices[0].message.content;

            } else if (this.settings.apiProvider === 'google') {
                if (!this.settings.googleApiKey) {
                    throw new Error('Google API key not configured.');
                }
                if (!this.genAI) {
                    this.genAI = new GoogleGenerativeAI(this.settings.googleApiKey);
                }

                const generationConfig: GenerationConfig = {
                    temperature: 0,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 8192,
                };

                const chatKey = systemPrompt;
                if (!this.chatSessions[chatKey]) {
                    const model = this.genAI.getGenerativeModel({
                        model: this.model,
                        systemInstruction: systemPrompt
                    });
                    this.chatSessions[chatKey] = model.startChat({
                        generationConfig: generationConfig,
                        history: [],
                    });
                }

                const chatSession = this.chatSessions[chatKey];
                const result = await chatSession.sendMessage(userInput);
                response = result.response.text();

            } else {
                throw new Error('API provider not configured correctly.');
            }

            const logResponse = response === null ? "" : response;
            // await this.appendToLog(systemPrompt, logResponse);
            return logResponse;
        } catch (error: any) {
            await this.appendToLog(systemPrompt, "", error);
            console.error('Error generating content:', error);
            throw new Error(error.message);
        }
    }

    async fetchTemplate(word: string): Promise<string> {
        const [dictionaryEntry, valenceBlock] = await Promise.all([
            this.generateContent(prompts.generate_dictionary_entry, word),
            this.generateContent(prompts.generate_valence_block, word)
        ]);
        return `${dictionaryEntry.replace('<agent_output>', '').replace('</agent_output>', '')}\n\n---\n${valenceBlock}`;
    }

    async determineInfinitiveAndEmoji(word: string): Promise<string> {
        return this.generateContent(prompts.determine_infinitive_and_pick_emoji, word);
    }

    async makeBrackets(text: string): Promise<string> {
        return this.generateContent(prompts.make_brackets, text);
    }

    async translateText(text: string): Promise<string> {
        return this.generateContent(prompts.translate_de_to_eng, text);
    }

    async translateRuToDe(text: string): Promise<string> {
        return this.generateContent(prompts.translate_ru_to_de, text);
    }

    async checkRuDeTranslation(text: string): Promise<string> {
        return this.generateContent(prompts.check_ru_de_translation, text);
    }
}
