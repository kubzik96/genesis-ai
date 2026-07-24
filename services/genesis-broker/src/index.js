/**
 * Genesis Secure GitHub Broker — Cloudflare Worker entry (S-0002).
 * CODE_ONLY stage: no live deployment, no secrets in repo.
 */
import { handleRequest } from './router.js';
import { createGithubClient } from './github-client.js';
import { BrokerDurableObject } from './durable-object.js';
import { MemoryBrokerStore } from './memory-store.js';

export { BrokerDurableObject };

export default {
  async fetch(request, env, ctx) {
    const runtimeEnv = { ...env };
    if (!runtimeEnv.store && env.BROKER_DO) {
      const id = env.BROKER_DO.idFromName('kubzik96/genesis-ai');
      runtimeEnv.brokerDoStub = env.BROKER_DO.get(id);
      runtimeEnv.store = runtimeEnv.store || new MemoryBrokerStore();
    }
    if (!runtimeEnv.github && env.GITHUB_PAT) {
      runtimeEnv.github = createGithubClient({ pat: env.GITHUB_PAT });
    }

    const result = await handleRequest(request, runtimeEnv);
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  },
};
