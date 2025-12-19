"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelGenerator = exports.ModelGenerator = void 0;
const character_description_generator_1 = require("./character-description-generator");
const provider_factory_1 = require("./providers/provider-factory");
class ModelGenerator {
    constructor() {
        this.descriptionGenerator = new character_description_generator_1.CharacterDescriptionGenerator();
        this.defaultProvider = provider_factory_1.ProviderFactory.getDefaultProvider();
    }
    /**
     * Generate 3D model from agent profile
     * Step 1: Generate character description (LLM)
     * Step 2: Generate model (3D provider)
     */
    generateModel(agentProfile, preferredStyle, providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[ModelGenerator] Starting model generation for agent ${agentProfile.id || agentProfile.agentId}`);
            // Step 1: Generate character description
            console.log('[ModelGenerator] Step 1: Generating character description...');
            const description = yield this.descriptionGenerator.generateDescription(agentProfile);
            console.log('[ModelGenerator] Character description generated:', JSON.stringify(description, null, 2));
            // Step 2: Select provider
            const provider = providerName
                ? provider_factory_1.ProviderFactory.createProvider(providerName)
                : this.selectProvider(description, preferredStyle);
            // Step 3: Generate model using provider
            console.log(`[ModelGenerator] Step 2: Generating model using ${provider.getName()}...`);
            const agentId = agentProfile.id || agentProfile.agentId;
            const model = yield provider.generateModel(description, agentId);
            console.log(`[ModelGenerator] Model generation completed: ${model.modelId}`);
            return model;
        });
    }
    /**
     * Select provider based on description and preferences
     */
    selectProvider(description, preferredStyle) {
        // Meshy supports text-to-3D from descriptions (works for all styles)
        // Ready Player Me only supports photo-based generation or web builder
        // So we prefer Meshy by default
        if (provider_factory_1.ProviderFactory.isProviderAvailable('meshy')) {
            return provider_factory_1.ProviderFactory.createProvider('meshy');
        }
        // Fallback to Ready Player Me if Meshy is not available
        // Note: Ready Player Me requires photo-based generation, not programmatic creation
        return this.defaultProvider;
    }
}
exports.ModelGenerator = ModelGenerator;
exports.modelGenerator = new ModelGenerator();
