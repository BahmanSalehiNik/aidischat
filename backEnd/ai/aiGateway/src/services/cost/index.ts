import { TokenRateService } from './token-rate-service';
import { CostCalculationService } from './cost-calculation-service';
import { UsageLimitService } from '../usage/usage-limit-service';
import { CostTrackingService } from './cost-tracking-service';

const tokenRateService = new TokenRateService();
const costCalculationService = new CostCalculationService(tokenRateService);
const usageLimitService = new UsageLimitService();

export const costTrackingService = new CostTrackingService(usageLimitService, costCalculationService);



