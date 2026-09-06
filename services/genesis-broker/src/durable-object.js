/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * Result contract includes githubStatus + idempotencyState for S-0002 §4.8 audit.
 * CONFLICT returns the authoritative existing record state as idempotencyState.
 */
import { evaluateIdempotency, markFailed, markSucceeded, markUnknown, isDeterministicClientError } from './idempotency.js';
import { checkHourlyWriteLimit, checkRunBounds, assertAssignIssueBelongsToRun } from './rate-limit.js';
import { createGithubClient, mapGithubError } from './github-client.js';
import { FIXED_FULL_NAME, IDEM_STATES } from './constants.js';
import { executeGrokDraftPrOperation } from './grok-draft-pr.js';
import { evaluateExecutorActivation, isStage1TestAdapter } from './executor-activation.js';
import { createXaiClient } from './xai-client.js';
import {
  budgetLedgerKey,
  releaseUnusedReservation,
  reserveBudget,
  settleBudget,
  XAI_BUDGET_RECONCILIATION_KEY,
} from './budget-ledger.js';
import { XAI_BUDGET_RESERVATION_TICKS } from './xai-contract.js';
import { createProductionXaiReviewClient } from './xai-review-client.js';
import { executeReviewerRuntimeOperation, validateReviewerRuntimeBody } from './reviewer-runtime.js';

export class BrokerDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this._queue = Promise.resolve();
  }

  _withLock(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async fetch(request) {
    if (!this.state?.storage) {
      return this._json({
        status: 503,
        body: { error: 'BLOCKED', message: 'DO storage unavailable; write blocked' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    const github = this.env?._github || createGithubClient({ pat: this.env?.GITHUB_PAT, fetchImpl: this.env?._fetchImpl });
    if (!github) {
      return this._json({
        status: 503,
        body: { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT not available in Durable Object' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return this._json({
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }
    if (payload?.operation === 'review_grok') {
      return this._withLock(() => this._processReview(payload, github));
    }
    return this._withLock(() => this._processWrite(payload, github));
  }

  async _processReview({ idempotencyKey, requestHash, runId, authorization, context }, github) {
    const storage = this.state.storage;
    const checked = validateReviewerRuntimeBody({ authorization, context, run_id: runId });
    if (!checked.ok) {
      return this._json({
        status: checked.status,
        body: checked.body,
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }
    if (typeof idempotencyKey !== 'string' || !idempotencyKey || typeof requestHash !== 'string' || !requestHash) {
      return this._json({
        status: 400,
        body: { error: 'INVALID_IDEMPOTENCY_ENVELOPE', message: 'Idempotency key and request hash are required' },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }

    const existing = (await storage.get(`idem:${idempotencyKey}`)) ?? null;
    const decision = evaluateIdempotency(existing, requestHash);
    if (decision.action === 'CONFLICT' || decision.action === 'BLOCKED' || decision.action === 'IN_FLIGHT') {
      const idempotencyState = decision.action === 'CONFLICT'
        ? existing?.state ?? null
        : decision.action === 'IN_FLIGHT'
          ? IDEM_STATES.PENDING
          : existing?.state ?? null;
      return this._json({
        status: decision.status,
        body: { error: decision.error, message: decision.message },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState,
      });
    }
    if (decision.action === 'REPLAY') {
      return this._json({
        status: decision.result?.status
          || (decision.state === IDEM_STATES.FAILED ? 409 : 200),
        body: decision.result?.body,
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: decision.state,
        replay: true,
      });
    }

    const runState = (await storage.get(`run:${runId}`)) ?? {
      create_issue: false,
      assign_copilot: false,
      create_branch_commit_draft_pr: false,
      create_branch_commit_draft_pr_blocked: false,
      create_branch_commit_draft_pr_pending: null,
      review_grok: false,
      review_grok_blocked: false,
      review_grok_pending: null,
      created_issue_number: null,
    };
    const bounds = checkRunBounds(runState, 'review_grok');
    if (!bounds.ok) {
      return this._json({
        status: bounds.status,
        body: { error: bounds.error, message: bounds.message },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }
    const rate = checkHourlyWriteLimit((await storage.get('rate:timestamps')) ?? []);
    if (!rate.ok) {
      return this._json({
        status: rate.status,
        body: { error: rate.error, message: rate.message },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }

    const explicitReviewClient = this.env?._reviewClient;
    if (!explicitReviewClient && this.env?.XAI_REVIEWER_LIVE_ENABLED !== 'true') {
      return this._json({
        status: 409,
        body: { error: 'REVIEW_PRODUCTION_OFF', message: 'Production reviewer transport is disabled' },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }
    if (
      !explicitReviewClient &&
      (typeof this.env?.XAI_API_KEY !== 'string' || !this.env.XAI_API_KEY ||
        typeof (this.env?._xaiFetchImpl || globalThis.fetch) !== 'function')
    ) {
      return this._json({
        status: 503,
        body: { error: 'REVIEW_PRODUCTION_UNAVAILABLE', message: 'Production reviewer transport is unavailable' },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }
    const baseReviewClient = explicitReviewClient || createProductionXaiReviewClient({
      productionEnabled: true,
      xaiApiKey: this.env?.XAI_API_KEY,
      fetchImpl: this.env?._xaiFetchImpl || globalThis.fetch,
    });
    if (typeof baseReviewClient?.review !== 'function') {
      return this._json({
        status: 503,
        body: { error: 'REVIEW_PRODUCTION_UNAVAILABLE', message: 'Production reviewer transport is unavailable' },
        githubCalled: false,
        githubStatus: null,
        modelCalled: false,
        persistenceAttempted: false,
        idempotencyState: null,
      });
    }

    const pending = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      operation: 'review_grok',
      run_id: runId,
      gate: null,
      state: IDEM_STATES.PENDING,
      safe_result: null,
    };
    await storage.put(Object.fromEntries([
      [`idem:${idempotencyKey}`, pending],
      [`run:${runId}`, {
        ...runState,
        review_grok_pending: { idempotency_key: idempotencyKey, request_hash: requestHash },
      }],
    ]));

    const calls = {
      githubCalled: false,
      githubStatus: null,
      modelCalled: false,
      persistenceAttempted: false,
    };
    const trackedGithub = {};
    for (const method of ['getPull', 'getPullFiles', 'getPullDiff', 'addIssueComment', 'getIssueComment']) {
      trackedGithub[method] = async (...args) => {
        calls.githubCalled = true;
        if (method === 'addIssueComment') calls.persistenceAttempted = true;
        const response = await github[method](...args);
        calls.githubStatus = response?.status ?? calls.githubStatus;
        return response;
      };
    }
    const reviewClient = {
      async review(input) {
        calls.modelCalled = true;
        return baseReviewClient.review(input);
      },
    };

    let operationResult;
    try {
      operationResult = await executeReviewerRuntimeOperation({
        authorization: checked.value.authorization,
        context: checked.value.context,
        github: trackedGithub,
        reviewClient,
      });
    } catch {
      operationResult = {
        status: 409,
        body: {
          ok: false,
          code: 'REVIEW_RUNTIME_FAILED',
          verdict: 'BLOCKED',
          ready_gate_safe: 'NO',
          consequential_gate_evidence_available: false,
          next_action: 'STOP_BLOCKED',
        },
      };
    }

    const safeResult = { status: operationResult.status, body: operationResult.body };
    if (operationResult.status === 200) {
      await storage.put(Object.fromEntries([
        [`idem:${idempotencyKey}`, markSucceeded(pending, safeResult)],
        [`run:${runId}`, { ...runState, review_grok: true, review_grok_pending: null }],
        ['rate:timestamps', rate.nextTimestamps],
      ]));
      return this._json({
        status: 200,
        body: operationResult.body,
        ...calls,
        idempotencyState: IDEM_STATES.SUCCEEDED,
      });
    }

    if (calls.persistenceAttempted) {
      const unknown = {
        error: 'BLOCKED_RECONCILIATION_REQUIRED',
        message: 'Review evidence write may be indeterminate; auto-retry forbidden',
      };
      await storage.put(Object.fromEntries([
        [`idem:${idempotencyKey}`, markUnknown(pending, unknown)],
        [`run:${runId}`, { ...runState, review_grok_blocked: true, review_grok_pending: null }],
      ]));
      return this._json({
        status: 409,
        body: unknown,
        ...calls,
        idempotencyState: IDEM_STATES.UNKNOWN,
        unknown: true,
      });
    }

    const failed = markFailed(pending, safeResult);
    await storage.put(Object.fromEntries([
      [`idem:${idempotencyKey}`, failed],
      [`run:${runId}`, calls.modelCalled
        ? { ...runState, review_grok: true, review_grok_pending: null }
        : { ...runState, review_grok_pending: null }],
    ]));
    return this._json({
      status: operationResult.status,
      body: operationResult.body,
      ...calls,
      idempotencyState: IDEM_STATES.FAILED,
    });
  }

  async _processWrite({ idempotencyKey, requestHash, operation, runId, gate, operationData }, github) {
    const storage = this.state.storage;

    const existing = (await storage.get(`idem:${idempotencyKey}`)) ?? null;
    const decision = evaluateIdempotency(existing, requestHash);

    if (decision.action === 'CONFLICT' || decision.action === 'BLOCKED' || decision.action === 'IN_FLIGHT') {
      let idempotencyState = null;
      if (decision.action === 'CONFLICT') {
        idempotencyState = existing?.state ?? null;
      } else if (decision.action === 'IN_FLIGHT') {
        idempotencyState = IDEM_STATES.PENDING;
      } else if (decision.action === 'BLOCKED' && decision.error === 'BLOCKED_RECONCILIATION_REQUIRED') {
        idempotencyState = IDEM_STATES.UNKNOWN;
      }
      return this._json({
        status: decision.status,
        body: { error: decision.error, message: decision.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState,
      });
    }
    if (decision.action === 'REPLAY') {
      return this._json({
        status: decision.state === IDEM_STATES.FAILED ? decision.result?.status || 400 : 200,
        body: decision.result,
        githubCalled: false,
        githubStatus: null,
        idempotencyState: decision.state,
        replay: true,
      });
    }

    const timestamps = (await storage.get('rate:timestamps')) ?? [];
    const rate = checkHourlyWriteLimit(timestamps);
    if (!rate.ok) {
      return this._json({
        status: rate.status,
        body: { error: rate.error, message: rate.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    const runState = (await storage.get(`run:${runId}`)) ?? {
      create_issue: false,
      assign_copilot: false,
      create_branch_commit_draft_pr: false,
      create_branch_commit_draft_pr_blocked: false,
      create_branch_commit_draft_pr_pending: null,
      created_issue_number: null,
    };
    const bounds = checkRunBounds(runState, operation);
    if (!bounds.ok) {
      return this._json({
        status: bounds.status,
        body: { error: bounds.error, message: bounds.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    if (operation === 'assign_copilot') {
      const belong = assertAssignIssueBelongsToRun(runState, operationData?.issueNumber);
      if (!belong.ok) {
        return this._json({
          status: belong.status,
          body: { error: belong.error, message: belong.message },
          githubCalled: false,
          githubStatus: null,
          idempotencyState: null,
        });
      }
    }
    const explicitXai = this.env?.xai || this.env?._xai;
    const stage1TestPath = operation === 'create_branch_commit_draft_pr' && isStage1TestAdapter(github, explicitXai);
    let xai = explicitXai;
    let budgetKey = null;
    let reservedBudget = null;
    let xaiMeter = null;

    if (operation === 'create_branch_commit_draft_pr' && !stage1TestPath) {
      const activation = evaluateExecutorActivation(this.env, { storageAvailable: Boolean(storage) });
      if (!activation.ok) {
        return this._json({
          status: activation.status,
          body: { error: activation.error, message: activation.message },
          githubCalled: false,
          githubStatus: null,
          idempotencyState: null,
        });
      }
      xai = createXaiClient({
        apiKey: this.env?.XAI_API_KEY,
        fetchImpl: this.env?._xaiFetchImpl || fetch,
      });
      if (!xai) {
        return this._json({
          status: 503,
          body: { error: 'EXECUTOR_DISABLED', message: 'Grok executor is disabled by reviewed activation policy' },
          githubCalled: false,
          githubStatus: null,
          idempotencyState: null,
        });
      }
      budgetKey = budgetLedgerKey(this.env?._now ? new Date(this.env._now) : new Date());
      const budgetValue = await storage.get(budgetKey);
      const reconciliationValue = await storage.get(XAI_BUDGET_RECONCILIATION_KEY);
      const reservation = reserveBudget(
        budgetValue,
        reconciliationValue,
      );
      if (!reservation.ok) {
        if (
          reservation.error === 'XAI_BUDGET_RECONCILIATION_REQUIRED' &&
          reconciliationValue?.blocked !== true
        ) {
          await storage.put(XAI_BUDGET_RECONCILIATION_KEY, { blocked: true });
        }
        return this._json({
          status: reservation.status,
          body: { error: reservation.error, message: budgetErrorMessage(reservation.error) },
          githubCalled: false,
          githubStatus: null,
          idempotencyState: null,
        });
      }
      reservedBudget = reservation.value;
      xaiMeter = createMeteredXai(xai);
      xai = xaiMeter.adapter;
    }

    const pending = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      operation,
      run_id: runId,
      gate,
      state: IDEM_STATES.PENDING,
      safe_result: null,
    };
    const reservedRunState = operation === 'create_branch_commit_draft_pr'
      ? {
        ...runState,
        create_branch_commit_draft_pr_pending: {
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
        },
      }
      : runState;
    if (operation === 'create_branch_commit_draft_pr') {
      const entries = [
        [`idem:${idempotencyKey}`, pending],
        [`run:${runId}`, reservedRunState],
      ];
      if (budgetKey && reservedBudget) {
        entries.push(
          [budgetKey, reservedBudget],
          [XAI_BUDGET_RECONCILIATION_KEY, { blocked: true }],
        );
      }
      await storage.put(Object.fromEntries(entries));
    } else {
      await storage.put(`idem:${idempotencyKey}`, pending);
    }

    const githubCall = buildGithubCall(operation, operationData, github, xai);
    let result;
    try {
      result = await githubCall();
    } catch {
      if (budgetKey && reservedBudget && xaiMeter) {
        if (xaiMeter.state.called) {
          const crashSettlement = settleBudget(reservedBudget, xaiMeter.state.costTicks);
          const entries = [
            [budgetKey, crashSettlement.value],
            [XAI_BUDGET_RECONCILIATION_KEY, {
              blocked: !crashSettlement.valid || crashSettlement.overReservation,
            }],
          ];
          await storage.put(Object.fromEntries(entries));
        } else {
          await storage.put(Object.fromEntries([
            [budgetKey, releaseUnusedReservation(reservedBudget)],
            [XAI_BUDGET_RECONCILIATION_KEY, { blocked: false }],
          ]));
        }
      }
      const safe = {
        error: 'BLOCKED_RECONCILIATION_REQUIRED',
        message: 'GitHub call timed out or returned indeterminate result; auto-retry forbidden',
      };
      if (operation === 'create_branch_commit_draft_pr') {
        await storage.put(Object.fromEntries([
          [`idem:${idempotencyKey}`, markUnknown(pending, safe)],
          [`run:${runId}`, {
            ...runState,
            create_branch_commit_draft_pr_blocked: true,
            create_branch_commit_draft_pr_pending: null,
          }],
        ]));
      } else {
        await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
      }
      return this._json({
        status: 409,
        body: safe,
        githubCalled: true,
        githubStatus: null,
        idempotencyState: IDEM_STATES.UNKNOWN,
        unknown: true,
      });
    }

    if (budgetKey && reservedBudget && xaiMeter) {
      if (!xaiMeter.state.called) {
        await storage.put(Object.fromEntries([
          [budgetKey, releaseUnusedReservation(reservedBudget)],
          [XAI_BUDGET_RECONCILIATION_KEY, { blocked: false }],
        ]));
      } else {
        const settlement = settleBudget(reservedBudget, xaiMeter.state.costTicks);
        const entries = [
          [budgetKey, settlement.value],
          [XAI_BUDGET_RECONCILIATION_KEY, {
            blocked: !settlement.valid || settlement.overReservation,
          }],
        ];
        await storage.put(Object.fromEntries(entries));
        if (!settlement.valid || settlement.overReservation) {
          result = {
            ok: false,
            status: 409,
            githubStatus: null,
            safeResult: {
              error: 'XAI_BUDGET_RECONCILIATION_REQUIRED',
              message: 'xAI cost could not be settled inside the reviewed reservation; live path blocked',
            },
          };
        }
      }
    }

    if (result.ok) {
      const succeededRecord = markSucceeded(pending, result.safeResult);
      const batchEntries = [
        [`idem:${idempotencyKey}`, succeededRecord],
        ['rate:timestamps', rate.nextTimestamps],
      ];
      if (operation === 'create_issue') {
        batchEntries.push([`run:${runId}`, {
          ...runState,
          create_issue: true,
          created_issue_number: result.safeResult?.issue_number ?? result.safeResult?.number ?? null,
        }]);
      } else if (operation === 'assign_copilot') {
        batchEntries.push([`run:${runId}`, { ...runState, assign_copilot: true }]);
      } else if (operation === 'create_branch_commit_draft_pr') {
        batchEntries.push([`run:${runId}`, {
          ...runState,
          create_branch_commit_draft_pr: true,
          create_branch_commit_draft_pr_pending: null,
        }]);
      }
      await storage.put(Object.fromEntries(batchEntries));
      return this._json({
        status: 200,
        body: result.safeResult,
        githubCalled: true,
        githubStatus: result.githubStatus ?? result.status ?? null,
        idempotencyState: IDEM_STATES.SUCCEEDED,
      });
    }

    if (isDeterministicClientError(result.status)) {
      if (operation === 'create_branch_commit_draft_pr' && result.postBranchFailure) {
        const safe = {
          error: 'BLOCKED_RECONCILIATION_REQUIRED',
          message: result.safeResult?.message || 'Post-branch failure requires reconciliation; auto-retry forbidden',
        };
        await storage.put(Object.fromEntries([
          [`idem:${idempotencyKey}`, markUnknown(pending, safe)],
          [`run:${runId}`, {
            ...runState,
            create_branch_commit_draft_pr_blocked: true,
            create_branch_commit_draft_pr_pending: null,
          }],
        ]));
        return this._json({
          status: 409,
          body: safe,
          githubCalled: true,
          githubStatus: result.githubStatus ?? result.status ?? null,
          idempotencyState: IDEM_STATES.UNKNOWN,
          unknown: true,
        });
      }
      if (operation === 'create_branch_commit_draft_pr') {
        const currentRunState = (await storage.get(`run:${runId}`)) ?? runState;
        await storage.put(Object.fromEntries([
          [`idem:${idempotencyKey}`, markFailed(pending, result.safeResult)],
          [`run:${runId}`, { ...currentRunState, create_branch_commit_draft_pr_pending: null }],
        ]));
      } else {
        await storage.put(`idem:${idempotencyKey}`, markFailed(pending, result.safeResult));
      }
      return this._json({
        status: result.status,
        body: result.safeResult,
        githubCalled: true,
        githubStatus: result.githubStatus ?? result.status ?? null,
        idempotencyState: IDEM_STATES.FAILED,
      });
    }

    const safe = {
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: `GitHub upstream error — indeterminate result (status ${result.status}); auto-retry forbidden`,
    };
    if (operation === 'create_branch_commit_draft_pr') {
      await storage.put(Object.fromEntries([
        [`idem:${idempotencyKey}`, markUnknown(pending, safe)],
        [`run:${runId}`, {
          ...runState,
          create_branch_commit_draft_pr_blocked: true,
          create_branch_commit_draft_pr_pending: null,
        }],
      ]));
    } else {
      await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
    }
    return this._json({
      status: 409,
      body: safe,
      githubCalled: true,
      githubStatus: result.githubStatus ?? result.status ?? null,
      idempotencyState: IDEM_STATES.UNKNOWN,
      unknown: true,
    });
  }

  _json(data) {
    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    });
  }
}

function buildGithubCall(operation, operationData, github, xai) {
  if (operation === 'create_issue') {
    return async () => {
      const res = await github.createIssue({
        title: operationData?.title,
        body: operationData?.body,
        labels: operationData?.labels,
      });
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, githubStatus: res.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        githubStatus: res.status,
        safeResult: {
          issue_number: res.data.number,
          number: res.data.number,
          html_url: res.data.html_url,
          title: res.data.title,
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  if (operation === 'assign_copilot') {
    return async () => {
      const res = await github.assignCopilot(operationData?.issueNumber);
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, githubStatus: res.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        githubStatus: res.status,
        safeResult: {
          issue_number: operationData?.issueNumber,
          assigned: (res.data?.assignees || []).map((a) => a.login),
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  if (operation === 'create_branch_commit_draft_pr') {
    if (
      !github ||
      !xai ||
      typeof github.getRef !== 'function' ||
      typeof github.getContentAtRef !== 'function' ||
      typeof github.createRef !== 'function' ||
      typeof github.updateFile !== 'function' ||
      typeof github.createPullRequest !== 'function' ||
      typeof xai.generateDraftPrChange !== 'function'
    ) {
      return async () => ({
        ok: false,
        status: 503,
        githubStatus: null,
        safeResult: {
          error: 'EXECUTOR_ADAPTERS_REQUIRED',
          message: 'Reviewed Grok executor adapters are not configured',
        },
      });
    }
    return async () => executeGrokDraftPrOperation({
      github,
      xai,
      runId: operationData?.runId,
      gate: operationData?.gate,
      confirmedAt: operationData?.confirmedAt,
      baseSha: operationData?.baseSha,
      task: operationData?.task,
    });
  }
  return async () => ({
    ok: false,
    status: 400,
    githubStatus: null,
    safeResult: { error: 'UNKNOWN_OPERATION', message: `Unknown operation: ${operation}` },
  });
}

function createMeteredXai(xai) {
  const state = { called: false, costTicks: null };
  return {
    state,
    adapter: {
      __productionAdapter: true,
      async generateDraftPrChange(input) {
        try {
          const result = await xai.generateDraftPrChange(input);
          state.called = true;
          if (!result?.__xaiProductionResult) {
            state.costTicks = null;
            throw new Error('Invalid production adapter result');
          }
          state.costTicks = result.costTicks;
          if (!Number.isSafeInteger(state.costTicks) || state.costTicks < 0) {
            throw new Error('Invalid xAI cost');
          }
          if (state.costTicks > XAI_BUDGET_RESERVATION_TICKS) {
            throw new Error('xAI cost exceeds reservation');
          }
          return result.output;
        } catch (error) {
          state.called = state.called || error?.called === true;
          if (Number.isSafeInteger(error?.costTicks) && error.costTicks >= 0) {
            state.costTicks = error.costTicks;
          }
          throw error;
        }
      },
    },
  };
}

function budgetErrorMessage(error) {
  if (error === 'XAI_BUDGET_EXCEEDED') return 'Monthly xAI budget does not have room for the required reservation';
  return 'xAI budget ledger requires reconciliation before another live call';
}
