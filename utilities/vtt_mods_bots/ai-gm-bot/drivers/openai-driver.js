const { OpenAI } = require('openai');
const AIDriver = require('./ai-driver');

class OpenAIDriver extends AIDriver {
    constructor(apiKey, model = 'gpt-4o-mini') {
        super();
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async generateResponse(context) {
        const messages = [
            { role: 'system', content: context.systemPrompt },
            ...context.messages
        ];

        const completion = await this.client.chat.completions.create({
            model: this.model,
            messages,
            max_tokens: 400,
            temperature: 0.8,
        });

        return completion.choices[0].message.content.trim();
    }
}

// Metadata for the configuration wizard
OpenAIDriver.meta = {
    name: 'OpenAI',
    description: 'Uses GPT-4o-mini (or another OpenAI model). Requires an API key.',
    requiredEnv: ['OPENAI_API_KEY']
};

module.exports = OpenAIDriver;
