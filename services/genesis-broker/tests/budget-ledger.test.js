import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetLedgerKey,
  releaseUnusedReservation,
  reserveBudget,
  settleBudget,
  utcBudgetMonth,
} from '../src/budget-ledger.js';
import {
  XAI_BUDGET_MONTHLY_LIMIT_TICKS,
  XAI_BUDGET_RESERVATION_TICKS,
} from '../src/xai-contract.js';

describe('xAI budget ledger', () => {
  it('uses UTC calendar months and integer ticks', () => {
    const date = new Date('2026-08-31T23:59:59.000Z');
    assert.equal(utcBudgetMonth(date), '2026-08');
    assert.equal(budgetLedgerKey(date), 'budget:xai:2026-08');
  });

  it('reserves USD 0.10 before a call and settles the authoritative actual cost', () => {
    const reserved = reserveBudget({ spent_ticks: 200, blocked: false });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.value.spent_ticks, 200 + XAI_BUDGET_RESERVATION_TICKS);
    const settled = settleBudget(reserved.value, 620_000_000);
    assert.deepEqual(settled, {
      value: { spent_ticks: 620_000_200, blocked: false },
      valid: true,
      overReservation: false,
    });
  });

  it('blocks over ceiling and reconciliation states', () => {
    const nearLimit = XAI_BUDGET_MONTHLY_LIMIT_TICKS - XAI_BUDGET_RESERVATION_TICKS + 1;
    assert.equal(reserveBudget({ spent_ticks: nearLimit }).error, 'XAI_BUDGET_EXCEEDED');
    assert.equal(reserveBudget({ spent_ticks: 0, blocked: true }).error, 'XAI_BUDGET_RECONCILIATION_REQUIRED');
  });

  it('keeps the full reservation and blocks on invalid cost, and records over-reservation cost', () => {
    const reserved = reserveBudget({ spent_ticks: 0 }).value;
    assert.deepEqual(settleBudget(reserved, undefined), {
      value: { spent_ticks: XAI_BUDGET_RESERVATION_TICKS, blocked: true },
      valid: false,
      overReservation: false,
    });
    const over = settleBudget(reserved, XAI_BUDGET_RESERVATION_TICKS + 1);
    assert.equal(over.value.spent_ticks, XAI_BUDGET_RESERVATION_TICKS + 1);
    assert.equal(over.value.blocked, true);
    assert.equal(over.overReservation, true);
  });

  it('releases a reservation only when the operation failed before xAI was called', () => {
    const reserved = reserveBudget({ spent_ticks: 50 }).value;
    assert.deepEqual(releaseUnusedReservation(reserved), { spent_ticks: 50, blocked: false });
  });
});
