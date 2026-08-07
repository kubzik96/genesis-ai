/**
 * DurableObjectProxyStore — Worker-side proxy that forwards write operations
 * to the BrokerDurableObject stub via HTTP.  All state (idempotency, rate limits,
 * run tracking, GitHub calls) is owned exclusively by the Durable Object instance
 * keyed to idFromName('kubzik96/genesis-ai').
 *
 * MemoryBrokerStore is used by unit tests only — never in production.
 */
export class DurableObjectProxyStore {
  /**
   * @param {DurableObjectStub} stub  — obtained via env.BROKER_DO.get(id)
   */
  constructor(stub) {
    this.stub = stub;
  }

  /**
   * Serialize the write operation to the Durable Object.
   * `githubCall` is intentionally ignored — the DO constructs its own GitHub
   * call from `operationData` using the PAT bound to the DO environment.
   */
  async executeWrite({ idempotencyKey, requestHash, operation, runId, gate, operationData }) {
    const response = await this.stub.fetch('https://do.internal/execute-write', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey, requestHash, operation, runId, gate, operationData }),
    });
    if (!response.ok) {
      return {
        status: 503,
        body: { error: 'DO_UNAVAILABLE', message: 'Durable Object returned non-ok response' },
        githubCalled: false,
      };
    }
    return response.json();
  }
}
