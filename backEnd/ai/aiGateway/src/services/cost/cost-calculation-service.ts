import { TokenRateService } from './token-rate-service';

export type CostCalculationInput = {
  provider: string;
  modelName: string;
  promptTokens?: number;
  completionTokens?: number;
  effectiveAt?: Date;
};

export class CostCalculationService {
  constructor(private tokenRateService: TokenRateService) {}

  /**
   * Computes USD micros for the given usage.
   *
   * Uses integer arithmetic:
   *  - tokenRate is "micros per 1,000,000 tokens"
   *  - costMicros = round(tokens * rateMicros / 1,000,000)
   */
  async calculateEstimatedCostMicros(input: CostCalculationInput): Promise<{
    estimatedCostMicros: number;
    rateSource: 'db' | 'default' | 'missing';
  }> {
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;

    const rate = await this.tokenRateService.getRate(input.provider, input.modelName, input.effectiveAt);
    const inputCostMicros = Math.round((promptTokens * rate.inputCostPerMillionMicros) / 1_000_000);
    const outputCostMicros = Math.round((completionTokens * rate.outputCostPerMillionMicros) / 1_000_000);

    return {
      estimatedCostMicros: inputCostMicros + outputCostMicros,
      rateSource: rate.source,
    };
  }
}



