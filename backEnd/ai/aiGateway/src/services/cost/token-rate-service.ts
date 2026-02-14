import { TokenRate } from '../../models/cost/token-rate';
import { DEFAULT_TOKEN_RATES } from './default-pricebook';

export type TokenRateResult = {
  provider: string;
  modelName: string;
  inputCostPerMillionMicros: number;
  outputCostPerMillionMicros: number;
  source: 'db' | 'default' | 'missing';
  effectiveDate?: Date;
};

export class TokenRateService {
  async getRate(provider: string, modelName: string, effectiveAt?: Date): Promise<TokenRateResult> {
    const providerLower = provider.toLowerCase();

    // 1) Try DB override
    const dbRate = await TokenRate.findEffectiveRate(providerLower, modelName, effectiveAt);
    if (dbRate) {
      return {
        provider: providerLower,
        modelName,
        inputCostPerMillionMicros: dbRate.inputCostPerMillionMicros,
        outputCostPerMillionMicros: dbRate.outputCostPerMillionMicros,
        source: 'db',
        effectiveDate: dbRate.effectiveDate,
      };
    }

    // 2) Fall back to baked-in defaults
    const key = `${providerLower}:${modelName}` as const;
    const defaultRate = DEFAULT_TOKEN_RATES[key];
    if (defaultRate) {
      // Optional: auto-seed into Mongo for visibility/override later
      if (process.env.COST_MONITORING_AUTO_SEED === 'true') {
        const defaultEffectiveDate = new Date('1970-01-01T00:00:00.000Z');
        await TokenRate.updateOne(
          { provider: providerLower, modelName, effectiveDate: defaultEffectiveDate },
          {
            $setOnInsert: {
              provider: providerLower,
              modelName,
              inputCostPerMillionMicros: defaultRate.inputCostPerMillionMicros,
              outputCostPerMillionMicros: defaultRate.outputCostPerMillionMicros,
              currency: 'USD',
              effectiveDate: defaultEffectiveDate,
            },
          },
          { upsert: true }
        );
      }

      return {
        provider: providerLower,
        modelName,
        inputCostPerMillionMicros: defaultRate.inputCostPerMillionMicros,
        outputCostPerMillionMicros: defaultRate.outputCostPerMillionMicros,
        source: 'default',
        effectiveDate: new Date('1970-01-01T00:00:00.000Z'),
      };
    }

    return {
      provider: providerLower,
      modelName,
      inputCostPerMillionMicros: 0,
      outputCostPerMillionMicros: 0,
      source: 'missing',
    };
  }
}



