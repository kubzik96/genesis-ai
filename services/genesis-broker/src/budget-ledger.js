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

export function normalizeBudgetLedger(value) {
  const spent = value?.spent_ticks;
  return {
    spent_ticks: Number.isSafeInteger(spent) && spent >= 0 ? spent : 0,
    blocked: value?.blocked === true,
  };
}

export function reserveBudget(value) {
  const ledger = normalizeBudgetLedger(value);
  if (ledger.blocked) {
    return { ok: false, status: 503, error: 'XAI_BUDGET_RECONCILIATION_REQUIRED' };
  }
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
  const ledger = normalizeBudgetLedger(value);
  return {
    spent_ticks: Math.max(0, ledger.spent_ticks - XAI_BUDGET_RESERVATION_TICKS),
    blocked: ledger.blocked,
  };
}

export function settleBudget(value, costTicks) {
  const ledger = normalizeBudgetLedger(value);
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
