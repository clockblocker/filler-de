import { requestUrl } from 'obsidian';
import { prompts } from './prompts';
import { MyPluginSettings } from './types';

export class ApiService {
    constructor(private settings: MyPluginSettings) {}

    async fetchTemplate(word: string) {
        return this.makeRequest(word, prompts.generate_dictionary_entry);
    }

    async determineInfinitiveAndEmoji(word: string) {
        return this.makeRequest(word, prompts.determine_infinitive_and_pick_emoji);
    }

    private async makeRequest(word: string, promptText: string) {
        const url = 'https://api.anthropic.com/v1/messages';
    
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.settings.anthropicKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31'
        };
    
        const body = {
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 1024,
            "system": [
                {
                    "type": "text",
                    "text": promptText,
                    "cache_control": { "type": "ephemeral" }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": word,
                }
            ]
        };

        try {
            const response = await requestUrl({
                url,
                method: 'POST',
                contentType: "application/json",
                body: JSON.stringify(body),
                headers,
            });

            return JSON.stringify(response);
        } catch (error) {
            return error + '\n\n' + JSON.stringify({ url, method: 'POST', headers, body });
        }
    }
}
