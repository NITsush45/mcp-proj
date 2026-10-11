// Lists available Gemini models using the container's own LLM_API_KEY env.
// Prints ONLY model names + status — never the key.
// Run: docker cp smoke/check-models.mjs <container>:/tmp/check-models.mjs && docker exec <container> node /tmp/check-models.mjs
import https from 'node:https';

const key = process.env.LLM_API_KEY;
if (!key) { console.error('NO_KEY_IN_ENV'); process.exit(2); }
console.log(`key present (len ${key.length})`);

function get(path) {
  return new Promise((resolve) => {
    const req = https.get(
      { hostname: 'generativelanguage.googleapis.com', path, headers: { 'x-goog-api-key': key } },
      (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    req.on('error', (e) => resolve({ status: 'ERR', body: e.message }));
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
  });
}

const r = await get('/v1beta/models?pageSize=100');
console.log(`models endpoint status: ${r.status}`);
if (r.status !== 200) {
  console.log(`body: ${r.body.slice(0, 400)}`);
  process.exit(1);
}
const names = JSON.parse(r.body).models.map((m) => m.name.replace(/^models\//, ''));
const flash = names.filter((n) => /flash/i.test(n));
console.log('flash-capable models:');
for (const n of flash) console.log(`  - ${n}`);
