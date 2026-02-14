/**
 * Default pricebook (USD per 1M tokens), stored as micros for exact arithmetic.
 *
 * NOTE: Provider pricing can change; Phase 1 uses a baked-in default + optional DB overrides.
 */
export type PricebookKey = `${string}:${string}`; // `${provider}:${modelName}`

const usdToMicrosPerMillion = (usdPerMillion: number) => Math.round(usdPerMillion * 1_000_000);

export const DEFAULT_TOKEN_RATES: Record<
  PricebookKey,
  { inputCostPerMillionMicros: number; outputCostPerMillionMicros: number }
> = {
  // OpenAI (example rates, see docs/cost-monitoring-investigation.md)
  'openai:gpt-3.5-turbo': {
    inputCostPerMillionMicros: usdToMicrosPerMillion(0.5),
    outputCostPerMillionMicros: usdToMicrosPerMillion(1.5),
  },
  'openai:gpt-4': {
    inputCostPerMillionMicros: usdToMicrosPerMillion(30),
    outputCostPerMillionMicros: usdToMicrosPerMillion(60),
  },
  'openai:gpt-4-turbo': {
    inputCostPerMillionMicros: usdToMicrosPerMillion(10),
    outputCostPerMillionMicros: usdToMicrosPerMillion(30),
  },
  // Anthropic (example rates)
  'anthropic:claude-3-opus': {
    inputCostPerMillionMicros: usdToMicrosPerMillion(15),
    outputCostPerMillionMicros: usdToMicrosPerMillion(75),
  },
  'anthropic:claude-3-sonnet': {
    inputCostPerMillionMicros: usdToMicrosPerMillion(3),
    outputCostPerMillionMicros: usdToMicrosPerMillion(15),
  },
};



