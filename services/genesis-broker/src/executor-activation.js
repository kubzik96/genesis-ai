import {
  GROK_EXECUTOR_CONFIG_SHA256,
  XAI_MODEL,
  XAI_RESPONSE_SCHEMA_SHA256,
} from './xai-contract.js';

const SHA_40 = /^[a-f0-9]{40}$/i;
const MAX_REVIEWED_SHAS = 20;

function disabled(reason) {
  return {
    ok: false,
    status: 503,
    error: 'EXECUTOR_DISABLED',
    message: 'Grok executor is disabled by reviewed activation policy',
    reason,
  };
}
function reviewedShas(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const values = value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (values.length > MAX_REVIEWED_SHAS || values.some((sha) => !SHA_40.test(sha))) return [];
  return [...new Set(values)];
}

export function evaluateExecutorActivation(env, { storageAvailable = false, requireDoBinding = false } = {}) {
  if (env?.GROK_EXECUTOR_LIVE_ENABLED !== 'true') return disabled('FLAG_OFF');
  if (!env?.XAI_API_KEY || !env?.GITHUB_PAT || !env?.BROKER_SERVICE_TOKEN) return disabled('SECRET_MISSING');
  if (requireDoBinding && !env?.BROKER_DO) return disabled('DURABLE_OBJECT_MISSING');
  if (!requireDoBinding && !storageAvailable) return disabled('BUDGET_LEDGER_MISSING');

  const deployedSha = String(env?.GENESIS_DEPLOYED_SHA || '').toLowerCase();
  if (!SHA_40.test(deployedSha)) return disabled('DEPLOYED_SHA_INVALID');
  const approved = reviewedShas(env?.GROK_EXECUTOR_REVIEWED_SHAS);
  if (!approved.includes(deployedSha)) return disabled('DEPLOYED_SHA_NOT_REVIEWED');

  if (env?.GROK_EXECUTOR_MODEL !== XAI_MODEL) return disabled('MODEL_MISMATCH');
  if (env?.GROK_EXECUTOR_SCHEMA_SHA256 !== XAI_RESPONSE_SCHEMA_SHA256) return disabled('SCHEMA_MISMATCH');
  if (env?.GROK_EXECUTOR_CONFIG_SHA256 !== GROK_EXECUTOR_CONFIG_SHA256) return disabled('CONFIG_MISMATCH');

  return { ok: true, deployedSha };
}

export function isStage1TestAdapter(github, xai) {
  return Boolean(
    github?.__stage1Mock === true &&
    xai?.__stage1Mock === true &&
    typeof xai.generateDraftPrChange === 'function',
  );
}
