/**
 * Validation and hard-limit enforcement for Grok draft-PR (T-011).
 */

import {
  GROK_MAX_FILES,
  GROK_ALLOWED_FILE,
  GROK_MAX_LINES,
  GROK_MAX_DIFF_BYTES,
} from './constants.js';
import { isAllowedGrokFile } from './allowlist.js';

/**
 * Validate incoming request body for draft-PR endpoint.
 * @param {object} body
 * @returns {{ ok: boolean, errors?: string[] }}
 */
export function validateGrokDraftPrRequest(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['body must be object'] };
  }
  if (!body.run_id || typeof body.run_id !== 'string') {
    errors.push('run_id required string');
  }
  if (!body.instruction || typeof body.instruction !== 'string') {
    errors.push('instruction required string');
  }
  if (!body.branch_name || typeof body.branch_name !== 'string') {
    errors.push('branch_name required string');
  }
  if (body.branch_name && !/^[a-zA-Z0-9._\/-]+$/.test(body.branch_name)) {
    errors.push('branch_name invalid characters');
  }
  if (body.expected_base_sha && typeof body.expected_base_sha !== 'string') {
    errors.push('expected_base_sha must be string');
  }
  if (body.confirmed_at !== undefined) {
    if (typeof body.confirmed_at !== 'string' || Number.isNaN(Date.parse(body.confirmed_at))) {
      errors.push('confirmed_at must be valid ISO date string');
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Validate xAI model response (closed JSON contract).
 * Expected shape: { path: string, content: string, diff_stats?: object }
 */
export function validateGrokResponse(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['response must be object'] };
  }
  if (typeof raw.path !== 'string' || !raw.path) {
    errors.push('path required string');
  }
  if (typeof raw.content !== 'string') {
    errors.push('content required string');
  }
  if (raw.path && !isAllowedGrokFile(raw.path)) {
    errors.push(`path not allowed: ${raw.path}`);
  }
  // UTF-8 check (no unpaired surrogates)
  if (typeof raw.content === 'string') {
    try {
      const encoded = new TextEncoder().encode(raw.content);
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
      if (decoded !== raw.content) {
        errors.push('content not valid UTF-8');
      }
    } catch {
      errors.push('content not valid UTF-8');
    }
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    normalized: {
      path: raw.path.replace(/^\.\//, ''),
      content: raw.content,
    },
  };
}

/**
 * Compute rough diff stats against empty or prior (for limits we use content size + line count).
 */
export function computeDiffStats(content) {
  const lines = content.split(/\r?\n/);
  const lineCount = lines.length;
  const bytes = new TextEncoder().encode(content).length;
  return { lines: lineCount, bytes };
}

/**
 * Enforce hard limits: 1 file MEMORY.md, ≤3 lines, ≤2 KiB.
 */
export function enforceHardLimits(normalized) {
  const reasons = [];
  if (normalized.path !== GROK_ALLOWED_FILE) {
    reasons.push(`only ${GROK_ALLOWED_FILE} allowed`);
  }
  const stats = computeDiffStats(normalized.content);
  // For Stage 1 we treat full content rewrite; line limit is on resulting content lines that differ.
  // Conservative: total lines in new content ≤ GROK_MAX_LINES OR changed lines ≤ limit.
  // Spec: ≤3 lines changed — we approximate by requiring content has ≤ GROK_MAX_LINES lines
  // when replacing a small memory file, or explicit diff if provided.
  if (stats.lines > GROK_MAX_LINES + 50) {
    // allow reasonable MEMORY.md size but reject huge dumps
    // actual changed-lines check is done when we have old content; here bound absolute size
  }
  if (stats.bytes > GROK_MAX_DIFF_BYTES * 4) {
    // absolute content size bound (diff itself ≤ 2KiB enforced below if diff present)
    reasons.push(`content too large: ${stats.bytes} bytes`);
  }
  // If model provided diff_stats, enforce strictly
  if (normalized.diff_stats) {
    if (normalized.diff_stats.changed_lines > GROK_MAX_LINES) {
      reasons.push(`changed_lines ${normalized.diff_stats.changed_lines} > ${GROK_MAX_LINES}`);
    }
    if (normalized.diff_stats.diff_bytes > GROK_MAX_DIFF_BYTES) {
      reasons.push(`diff_bytes ${normalized.diff_stats.diff_bytes} > ${GROK_MAX_DIFF_BYTES}`);
    }
  } else {
    // Without explicit diff, enforce content byte limit as proxy for 2KiB diff
    if (stats.bytes > GROK_MAX_DIFF_BYTES) {
      reasons.push(`content bytes ${stats.bytes} exceed ${GROK_MAX_DIFF_BYTES} (no diff_stats)`);
    }
    if (stats.lines > GROK_MAX_LINES) {
      // soft: MEMORY.md can be longer; only reject if clearly over for a "3-line change"
      // Stage 1 strict: require ≤3 lines total for the edit payload when no prior
      reasons.push(`lines ${stats.lines} > ${GROK_MAX_LINES} (no prior content for precise diff)`);
    }
  }
  return reasons.length ? { ok: false, reasons } : { ok: true, stats };
}
