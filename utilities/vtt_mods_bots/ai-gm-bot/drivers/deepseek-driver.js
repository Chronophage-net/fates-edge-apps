const AIDriver = require('./ai-driver');

class DeepSeekDriver extends AIDriver {
    constructor() {
        super();
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    }

    async generateResponse(context) {
        const messages = [
            { role: 'system', content: context.systemPrompt },
            ...context.messages
        ];

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                max_tokens: 400,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API error (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
}

DeepSeekDriver.meta = {
    name: 'DeepSeek',
    description: 'Uses the DeepSeek Chat API. Requires an API key.',
    requiredEnv: ['DEEPSEEK_API_KEY']
};

module.exports = DeepSeekDriver;
