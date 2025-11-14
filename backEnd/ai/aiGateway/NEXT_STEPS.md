Next Steps
==========

- Replace the placeholder provisioning stub with real provider-specific agent creation logic and surface provider API errors.
- Verify the end-to-end flow in an integration environment (Kafka topics, Mongo replicas, provider credentials) before promoting.
- Consider adding retries/backoff policies in the agent service when `agent.creation_failed` events are marked as retryable.

