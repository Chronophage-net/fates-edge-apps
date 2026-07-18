const { OpenAI } = require('openai');
const AIDriver = require('../ai-driver');

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

module.exports = OpenAIDriver;
