import {
  XAI_BUDGET_MONTHLY_LIMIT_TICKS,
  XAI_BUDGET_RESERVATION_TICKS,
} from './xai-contract.js';

export function utcBudgetMonth(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('valid date required');
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function budgetLedgerKey(date = new Date()) {
  return `budget:xai:${utcBudgetMonth(date)}`;
}

export const XAI_BUDGET_RECONCILIATION_KEY = 'budget:xai:reconciliation';

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeBudgetLedger(value) {
  if (value === undefined || value === null) {
    return { ok: true, value: { spent_ticks: 0, blocked: false } };
  }
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.spent_ticks) ||
    value.spent_ticks < 0 ||
    typeof value.blocked !== 'boolean'
  ) {
    return {
      ok: false,
      value: { spent_ticks: XAI_BUDGET_MONTHLY_LIMIT_TICKS, blocked: true },
    };
  }
  return {
    ok: true,
    value: { spent_ticks: value.spent_ticks, blocked: value.blocked },
  };
}

export function normalizeBudgetReconciliation(value) {
  if (value === undefined || value === null) return { ok: true, value: { blocked: false } };
  if (!isRecord(value) || typeof value.blocked !== 'boolean') {
    return { ok: false, value: { blocked: true } };
  }
  return { ok: true, value: { blocked: value.blocked } };
}

export function reserveBudget(value, reconciliationValue) {
  const reconciliation = normalizeBudgetReconciliation(reconciliationValue);
  const normalized = normalizeBudgetLedger(value);
  if (!reconciliation.ok || reconciliation.value.blocked || !normalized.ok || normalized.value.blocked) {
    return { ok: false, status: 503, error: 'XAI_BUDGET_RECONCILIATION_REQUIRED' };
  }
  const ledger = normalized.value;
  if (ledger.spent_ticks + XAI_BUDGET_RESERVATION_TICKS > XAI_BUDGET_MONTHLY_LIMIT_TICKS) {
    return { ok: false, status: 429, error: 'XAI_BUDGET_EXCEEDED' };
  }
  return {
    ok: true,
    value: {
      spent_ticks: ledger.spent_ticks + XAI_BUDGET_RESERVATION_TICKS,
      blocked: false,
    },
  };
}

export function releaseUnusedReservation(value) {
  const normalized = normalizeBudgetLedger(value);
  if (!normalized.ok) return normalized.value;
  const ledger = normalized.value;
  return {
    spent_ticks: Math.max(0, ledger.spent_ticks - XAI_BUDGET_RESERVATION_TICKS),
    blocked: ledger.blocked,
  };
}

export function settleBudget(value, costTicks) {
  const normalized = normalizeBudgetLedger(value);
  if (!normalized.ok) {
    return { value: normalized.value, valid: false, overReservation: false };
  }
  const ledger = normalized.value;
  if (!Number.isSafeInteger(costTicks) || costTicks < 0) {
    return { value: { ...ledger, blocked: true }, valid: false, overReservation: false };
  }
  const settled = ledger.spent_ticks - XAI_BUDGET_RESERVATION_TICKS + costTicks;
  const overReservation = costTicks > XAI_BUDGET_RESERVATION_TICKS;
  return {
    value: { spent_ticks: Math.max(0, settled), blocked: ledger.blocked || overReservation },
    valid: true,
    overReservation,
  };
}
