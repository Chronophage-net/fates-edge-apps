const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen3-coder:480b-cloud';

(async () => {
    console.log(`Testing Ollama at ${OLLAMA_URL} with model "${MODEL}"...`);
    try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                prompt: 'Say "Hello, Fate\'s Edge!" and nothing else.',
                stream: false
            })
        });

        if (!res.ok) {
            console.error(`HTTP ${res.status}: ${await res.text()}`);
            process.exit(1);
        }

        const data = await res.json();
        console.log('✅ Response:', data.response);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();
