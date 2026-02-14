import { LlmInteraction, type LlmFeature } from '../../models/cost/llm-interaction';
import { UserDailyUsage } from '../../models/cost/user-daily-usage';
import { UserMonthlyUsage } from '../../models/cost/user-monthly-usage';
import { CostCalculationService } from './cost-calculation-service';
import { utcDayStringForNow, utcMonthStringForNow, UsageLimitService } from '../usage/usage-limit-service';
import type { AiProviderRequest, AiProviderResponse } from '../../providers/base-provider';

export type TrackContext = {
  idempotencyKey: string;
  ownerUserId: string;
  agentId?: string;
  feature: LlmFeature;
  provider: string;
  modelName: string;
  request: AiProviderRequest;
  metadata?: Record<string, any>;
};

export class CostTrackingService {
  constructor(
    private usageLimitService: UsageLimitService,
    private costCalculationService: CostCalculationService
  ) {}

  isEnabled(): boolean {
    // Default to on (monitoring). Enforcement is separately gated.
    return process.env.COST_MONITORING_ENABLED !== 'false';
  }

  async assertWithinLimits(ownerUserId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.isEnabled()) return { ok: true };
    if (!this.usageLimitService.isEnforcementEnabled()) return { ok: true };

    await this.usageLimitService.seedDefaultTierIfMissing();
    const decision = await this.usageLimitService.checkDailyHardCap(ownerUserId);
    if (!decision.allow) {
      return { ok: false, message: decision.message };
    }
    return { ok: true };
  }

  async trackGenerateResponse(
    ctx: TrackContext,
    fn: () => Promise<AiProviderResponse>
  ): Promise<AiProviderResponse> {
    const startedAt = new Date();
    let endedAt = new Date();
    let response: AiProviderResponse | null = null;
    let errorMessage: string | null = null;

    try {
      response = await fn();
      endedAt = new Date();
      if (response?.error) {
        errorMessage = response.error;
      }
      return response;
    } catch (err: any) {
      endedAt = new Date();
      errorMessage = err?.message || 'Unknown error';
      throw err;
    } finally {
      if (!this.isEnabled()) {
        // monitoring disabled: do not record anything
      } else {
        const durationMs = endedAt.getTime() - startedAt.getTime();
        const promptTokens = response?.usage?.promptTokens;
        const completionTokens = response?.usage?.completionTokens;
        const totalTokens = response?.usage?.totalTokens;

        let estimatedCostMicros = 0;
        try {
          if (promptTokens != null || completionTokens != null) {
            const costResult = await this.costCalculationService.calculateEstimatedCostMicros({
              provider: ctx.provider,
              modelName: ctx.modelName,
              promptTokens: promptTokens ?? 0,
              completionTokens: completionTokens ?? 0,
            effectiveAt: startedAt,
            });
            estimatedCostMicros = costResult.estimatedCostMicros;
          }
        } catch (calcErr) {
          // never block main flow due to cost calc issues
          estimatedCostMicros = 0;
        }

        // Upsert interaction record (idempotent)
        await LlmInteraction.updateOne(
          { idempotencyKey: ctx.idempotencyKey },
          {
            $setOnInsert: {
              idempotencyKey: ctx.idempotencyKey,
              ownerUserId: ctx.ownerUserId,
              agentId: ctx.agentId,
              feature: ctx.feature,
              provider: ctx.provider.toLowerCase(),
              modelName: ctx.modelName,
              startedAt,
            },
            $set: {
              endedAt,
              durationMs,
              promptTokens,
              completionTokens,
              totalTokens,
              estimatedCostMicros,
              metadata: {
                ...ctx.metadata,
                // store minimal request properties for debugging
                maxTokens: ctx.request.maxTokens,
                temperature: ctx.request.temperature,
                responseFormat: ctx.request.responseFormat,
                hasImages: (ctx.request.imageUrls?.length || 0) > 0,
              },
              errorMessage: errorMessage,
            },
          },
          { upsert: true }
        );

        // Only aggregate successful calls with known tokens.
        if (!errorMessage && totalTokens != null) {
          const day = utcDayStringForNow(new Date());
        const month = utcMonthStringForNow(new Date());
          await UserDailyUsage.updateOne(
            { ownerUserId: ctx.ownerUserId, day },
            {
              $setOnInsert: { ownerUserId: ctx.ownerUserId, day },
              $inc: {
                totalAiCalls: 1,
                totalMessages: 1,
                totalPromptTokens: promptTokens ?? 0,
                totalCompletionTokens: completionTokens ?? 0,
                totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
                totalCostMicros: estimatedCostMicros,
              },
            },
            { upsert: true }
          );

        await UserMonthlyUsage.updateOne(
          { ownerUserId: ctx.ownerUserId, month },
          {
            $setOnInsert: { ownerUserId: ctx.ownerUserId, month },
            $inc: {
              totalAiCalls: 1,
              totalMessages: 1,
              totalPromptTokens: promptTokens ?? 0,
              totalCompletionTokens: completionTokens ?? 0,
              totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
              totalCostMicros: estimatedCostMicros,
            },
          },
          { upsert: true }
        );
        }
      }
    }
  }
}



