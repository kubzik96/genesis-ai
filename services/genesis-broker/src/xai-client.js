/**
 * xAI client for limited Grok executor (T-011 Stage 1).
 * Closed JSON contract; mock-first. Live path exists only when explicitly enabled
 * and is never exercised by unit/contract tests.
 */

/**
 * @param {object} opts
 * @param {string} [opts.apiKey]
 * @param {boolean} [opts.mock] — when true (default in tests / Stage 1) never hits network
 * @param {Function} [opts.fetchImpl]
 */
export function createXaiClient({ apiKey, mock = true, fetchImpl = fetch } = {}) {
  return {
    /**
     * Generate a draft edit for the single allowed file.
     * @param {{ file: string, instruction: string, currentContent?: string, context?: object }}
     * @returns {Promise<{ path: string, content: string }>}
     */
    async generateDraftEdit({ file, instruction, currentContent, context }) {
      // Stage 1 default: mock. Live only if mock===false AND apiKey present.
      if (mock !== false || !apiKey) {
        const base = typeof currentContent === 'string' ? currentContent : '# MEMORY\n\n';
        const note = String(instruction || '').trim().slice(0, 60);
        // Produce a small 1–2 line append that stays within hard limits
        const addition = note ? `- note: ${note}` : '- note: mock edit';
        const content = base.endsWith('\n') ? `${base}${addition}\n` : `${base}\n${addition}\n`;
        return {
          path: file,
          content,
        };
      }

      // Live path (disabled for Stage 1 tests and default runtime)
      const res = await fetchImpl('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: [
            {
              role: 'system',
              content:
                'Return ONLY valid JSON: {"path":"MEMORY.md","content":"..."}. No markdown fences. Change at most 3 lines.',
            },
            {
              role: 'user',
              content: `File: ${file}\nCurrent:\n${String(currentContent || '').slice(0, 4000)}\nInstruction: ${instruction}\nContext: ${JSON.stringify(context || {})}`,
            },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`xAI ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('xAI response not valid JSON');
      }
    },
  };
}
