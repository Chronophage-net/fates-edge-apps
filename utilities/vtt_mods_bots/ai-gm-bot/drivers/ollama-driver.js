const AIDriver = require('./ai-driver');

class OllamaDriver extends AIDriver {
    constructor() {
        super();
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'mistral';
        this.apiKey = process.env.OLLAMA_API_KEY || null;
    }

    async generateResponse(context) {
        const prompt = context.systemPrompt + '\n\n' +
            context.messages.map(m => `${m.role}: ${m.content}`).join('\n') +
            '\nassistant:';

        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: this.model,
                prompt,
                stream: false,
                options: { temperature: 0.8, num_predict: 400 }
            })
        });

        if (!response.ok) throw new Error(`Ollama error (${response.status})`);
        const data = await response.json();
        return data.response.trim();
    }
}

OllamaDriver.meta = {
    name: 'Ollama',
    description: 'Local or cloud Ollama server. Needs base URL + model (optional API key).',
    requiredEnv: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL']
};

module.exports = OllamaDriver;
