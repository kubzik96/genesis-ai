/**
 * xAI client for limited Grok executor.
 * Closed JSON contract; mockable for tests.
 */

/**
 * @param {object} opts
 * @param {string} [opts.apiKey]
 * @param {boolean} [opts.mock]
 */
export function createXaiClient({ apiKey, mock = false } = {}) {
  return {
    /**
     * Generate a draft edit for a single allowed file.
     * @param {{ file: string, instruction: string, context?: object }}
     * @returns {Promise<{ path: string, content: string, diff_stats?: object }>}
     */
    async generateDraftEdit({ file, instruction, context }) {
      if (mock || !apiKey) {
        // Deterministic mock for unit tests
        return {
          path: file,
          content: `# MEMORY\n\n- mock edit from instruction: ${String(instruction).slice(0, 80)}\n`,
          diff_stats: { changed_lines: 2, diff_bytes: 120 },
        };
      }

      // Live path (not used in Stage 1 tests)
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
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
                'Return ONLY valid JSON: {"path":"MEMORY.md","content":"...","diff_stats":{"changed_lines":N,"diff_bytes":N}}. No markdown.',
            },
            {
              role: 'user',
              content: `File: ${file}\nInstruction: ${instruction}\nContext: ${JSON.stringify(context || {})}`,
            },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`xAI ${res.status}: ${t}`);
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
