/**
 * Seed OpenAI token pricing into ai-gateway MongoDB (`TokenRate` collection).
 *
 * Why a script?
 * - Provider pricing changes over time.
 * - In Phase 1 we keep runtime code simple and store pricing in Mongo (with effectiveDate versioning).
 * - Later we'll replace this with an admin panel + scheduled job.
 *
 * Notes
 * - Prices below are intended to be maintained by engineering. Update them to match OpenAI pricing.
 * - Costs are stored as USD micros per 1,000,000 tokens (matches `TokenRate` schema).
 *
 * Usage:
 *   MONGO_URI="mongodb://localhost:27017/ai-gateway" \
 *     node backEnd/ai/aiGateway/scripts/seed-openai-token-rates.js --effectiveDate 2026-02-14
 *
 *   node backEnd/ai/aiGateway/scripts/seed-openai-token-rates.js \
 *     --mongoUri "mongodb://localhost:27017/ai-gateway" \
 *     --effectiveDate 2026-02-14
 */
const mongoose = require('mongoose');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mongoUri' || arg === '--mongo-uri') out.mongoUri = argv[++i];
    else if (arg === '--effectiveDate' || arg === '--effective-date') out.effectiveDate = argv[++i];
    else if (arg === '--dryRun' || arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`
Seed OpenAI TokenRate pricing into MongoDB.

Options:
  --mongoUri <uri>           Mongo connection string (or set MONGO_URI)
  --effectiveDate <YYYY-MM-DD>  Effective date to use for these prices (default: today UTC)
  --dryRun                  Print planned ops without writing
`);
}

function utcDateFromYmd(ymd) {
  // ymd: "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Invalid --effectiveDate "${ymd}". Expected YYYY-MM-DD`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
}

const usdToMicrosPerMillion = (usdPerMillion) => Math.round(usdPerMillion * 1_000_000);

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const mongoUri = args.mongoUri || process.env.MONGO_URI;
  if (!mongoUri) {
    printHelp();
    throw new Error('Missing Mongo URI. Provide --mongoUri or set MONGO_URI.');
  }

  const effectiveDate =
    args.effectiveDate != null
      ? utcDateFromYmd(args.effectiveDate)
      : utcDateFromYmd(new Date().toISOString().slice(0, 10));

  // IMPORTANT: Update these values to match OpenAI pricing for your account/models.
  // Stored as USD per 1,000,000 tokens.
  const openAiRates = [
    // Most common default in this repo: backEnd/agents defaults to `gpt-4o`
    { modelName: 'gpt-4o', inputUsdPerMillion: 5.0, outputUsdPerMillion: 15.0 },
    { modelName: 'gpt-4o-mini', inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
    // Legacy / fallback models still referenced in the codebase
    { modelName: 'gpt-4-turbo', inputUsdPerMillion: 10.0, outputUsdPerMillion: 30.0 },
    { modelName: 'gpt-4', inputUsdPerMillion: 30.0, outputUsdPerMillion: 60.0 },
    { modelName: 'gpt-3.5-turbo', inputUsdPerMillion: 0.5, outputUsdPerMillion: 1.5 },
  ];

  const TokenRateSchema = new mongoose.Schema(
    {
      provider: { type: String, required: true, index: true },
      modelName: { type: String, required: true, index: true },
      inputCostPerMillionMicros: { type: Number, required: true },
      outputCostPerMillionMicros: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      effectiveDate: { type: Date, default: () => new Date(), index: true },
    },
    { timestamps: true }
  );
  TokenRateSchema.index({ provider: 1, modelName: 1, effectiveDate: 1 }, { unique: true });

  const TokenRate = mongoose.models.TokenRate || mongoose.model('TokenRate', TokenRateSchema);

  console.log('[seed-openai-token-rates] Connecting to Mongo:', mongoUri);
  await mongoose.connect(mongoUri);
  console.log('[seed-openai-token-rates] Connected');

  let upserted = 0;
  let matched = 0;

  for (const r of openAiRates) {
    const doc = {
      provider: 'openai',
      modelName: r.modelName,
      inputCostPerMillionMicros: usdToMicrosPerMillion(r.inputUsdPerMillion),
      outputCostPerMillionMicros: usdToMicrosPerMillion(r.outputUsdPerMillion),
      currency: 'USD',
      effectiveDate,
    };

    if (args.dryRun) {
      console.log('[dryRun] upsert', { filter: { provider: doc.provider, modelName: doc.modelName, effectiveDate }, doc });
      continue;
    }

    const res = await TokenRate.updateOne(
      { provider: doc.provider, modelName: doc.modelName, effectiveDate },
      { $setOnInsert: doc },
      { upsert: true }
    );

    // mongoose uses different shapes across versions; handle both
    const wasUpsert = (res && (res.upsertedCount || (res.upsertedId ? 1 : 0))) ? 1 : 0;
    if (wasUpsert) upserted += 1;
    else matched += 1;
  }

  console.log('[seed-openai-token-rates] Done', {
    provider: 'openai',
    effectiveDate: effectiveDate.toISOString(),
    models: openAiRates.length,
    upserted,
    alreadyPresent: matched,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed-openai-token-rates] ERROR:', err?.stack || err?.message || err);
  process.exit(1);
});


