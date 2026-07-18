const AIDriver = require('./drivers/ai-driver');
// const fetch = require('node-fetch'); // or built-in fetch

class OllamaDriver extends AIDriver {
    constructor(model = 'mistral') {
        super();
        this.model = model;
    }

    async generateResponse(context) {
        const prompt = context.systemPrompt + '\n\n' +
            context.messages.map(m => `${m.role}: ${m.content}`).join('\n') +
            '\nassistant:';

        const res = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt,
                stream: false
            })
        });
        const json = await res.json();
        return json.response.trim();
    }
}

module.exports = OllamaDriver;
