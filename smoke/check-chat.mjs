// Probes Gemini's OpenAI-compatible chat/completions, the same shape the gateway sends.
// Usage: docker cp smoke/check-chat.mjs <container>:/tmp/check-chat.mjs && docker exec <container> node /tmp/check-chat.mjs
const key = process.env.LLM_API_KEY;
const base = (process.env.LLM_BASE_URL ?? '').replace(/\/$/, '');
const model = process.env.LLM_MODEL ?? '';
console.log(`model=${model} base=${base}`);

async function probe(path, auth) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'say hi in 3 words' }],
      max_tokens: 20,
    }),
  });
  const text = await r.text();
  console.log(`-- ${path} auth=${Object.keys(auth)} -> ${r.status}: ${text.slice(0, 300)}`);
}

await probe('/chat/completions', { Authorization: `Bearer ${key}` });
await probe(`/chat/completions?key=${key}`, {});
