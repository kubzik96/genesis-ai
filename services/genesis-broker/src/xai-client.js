/**
 * Closed-contract xAI client for S-0005 limited Grok executor.
 * Stage 1: runtime path is always injected/mocked in tests; no live network in unit tests.
 */
const DEFAULT_SYSTEM = `You are a limited code executor for Genesis. Return ONLY a JSON object with keys:
explanation (string), changes (array of exactly one object with path, expected_blob_sha, content), self_check (object).
No markdown, no extra fields. Only edit the single allowed file. Keep total changed lines <= 3.`;

export function createXaiClient({ apiKey, fetchImpl = fetch, model = 'grok-3' } = {}) {
  async function complete({ instruction, contextFiles, allowedFiles }) {
    if (!apiKey) {
      return { ok: false, status: 503, error: 'XAI_NOT_CONFIGURED', message: 'XAI_API_KEY not configured — fail-closed' };
    }
    const userPayload = {
      instruction,
      allowed_files: allowedFiles,
      context: contextFiles.map((f) => ({ path: f.path, sha: f.sha, content: f.content })),
    };
    const body = {
      model,
      messages: [
        { role: 'system', content: DEFAULT_SYSTEM },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    };
    let res;
    try {
      res = await fetchImpl('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'genesis-broker-mvp',
        },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 502, error: 'XAI_NETWORK_ERROR', message: 'xAI request failed (network)' };
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      return { ok: false, status: 502, error: 'XAI_INVALID_RESPONSE', message: 'xAI returned non-JSON' };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status >= 400 ? res.status : 502,
        error: `XAI_${res.status}`,
        message: String(data?.error?.message || data?.message || 'xAI error').slice(0, 300),
      };
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, status: 502, error: 'XAI_EMPTY_CONTENT', message: 'xAI response missing message content' };
    }
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return { ok: false, status: 400, error: 'INVALID_MODEL_JSON', message: 'Model content is not valid JSON' };
    }
    return { ok: true, data: parsed };
  }
  return { complete };
}
