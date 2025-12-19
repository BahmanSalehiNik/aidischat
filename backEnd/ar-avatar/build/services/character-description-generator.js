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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.characterDescriptionGenerator = exports.CharacterDescriptionGenerator = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../config/constants");
class CharacterDescriptionGenerator {
    /**
     * Generate character description from agent profile using LLM
     */
    generateDescription(agentProfile) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = this.buildPrompt(agentProfile);
            try {
                const description = yield this.callLLM(prompt);
                return this.parseDescription(description);
            }
            catch (error) {
                console.error('[CharacterDescriptionGenerator] Error generating description:', error);
                // Fallback to rule-based generation
                return this.generateFallbackDescription(agentProfile);
            }
        });
    }
    buildPrompt(agentProfile) {
        return `Given this agent profile:
${JSON.stringify(agentProfile, null, 2)}

Generate a detailed character description in JSON format with the following structure:
{
  "style": "anime" | "realistic" | "cartoon" | "chibi" | "robot" | "fantasy",
  "subcategory": "brief subcategory description (e.g., 'fantasy ranger', 'cyberpunk hacker')",
  "gender": "male" | "female" | "neutral",
  "species": "human" | "elf" | "android" | "animal" | "creature",
  "bodyType": "slim" | "average" | "strong" | "small",
  "height": "height description (e.g., '1.75m', 'tall', 'average')",
  "hair": {
    "color": "hair color (e.g., 'silver', 'black', 'blonde')",
    "style": "hair style (e.g., 'long', 'short', 'curly')"
  },
  "eyes": {
    "color": "eye color (e.g., 'emerald green', 'blue', 'brown')"
  },
  "clothing": "clothing description (e.g., 'light leather armor', 'casual t-shirt')",
  "colorPalette": ["#HEX1", "#HEX2", "#HEX3"],
  "expressionBaseline": "calm" | "energetic" | "cute" | "dramatic",
  "build": "build description (e.g., 'slim athletic', 'muscular')",
  "accessories": ["optional", "accessories", "list"]
}

Return only valid JSON, no markdown, no code blocks.`;
    }
    callLLM(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            if (constants_1.AVATAR_CONFIG.LLM_PROVIDER === 'openai') {
                return this.callOpenAI(prompt);
            }
            else if (constants_1.AVATAR_CONFIG.LLM_PROVIDER === 'claude') {
                return this.callClaude(prompt);
            }
            else {
                throw new Error(`Unsupported LLM provider: ${constants_1.AVATAR_CONFIG.LLM_PROVIDER}`);
            }
        });
    }
    callOpenAI(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: constants_1.AVATAR_CONFIG.LLM_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a character description generator. Always return valid JSON only, no markdown, no code blocks.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }, {
                headers: {
                    'Authorization': `Bearer ${constants_1.AVATAR_CONFIG.LLM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });
            const content = (_b = (_a = response.data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
            if (!content) {
                throw new Error('No content in OpenAI response');
            }
            return content;
        });
    }
    callClaude(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement Claude API call
            throw new Error('Claude provider not yet implemented');
        });
    }
    parseDescription(jsonString) {
        try {
            // Remove markdown code blocks if present
            let cleaned = jsonString.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            }
            else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(cleaned);
            return this.validateDescription(parsed);
        }
        catch (error) {
            console.error('[CharacterDescriptionGenerator] Error parsing description:', error);
            throw new Error(`Failed to parse character description: ${error}`);
        }
    }
    validateDescription(desc) {
        // Validate and set defaults
        return {
            style: desc.style || 'realistic',
            subcategory: desc.subcategory,
            gender: desc.gender || 'neutral',
            species: desc.species || 'human',
            bodyType: desc.bodyType || 'average',
            height: desc.height || 'average',
            hair: desc.hair || { color: 'brown', style: 'medium' },
            eyes: desc.eyes || { color: 'brown' },
            clothing: desc.clothing || 'casual clothing',
            colorPalette: desc.colorPalette || ['#4A90E2', '#F5A623'],
            expressionBaseline: desc.expressionBaseline || 'calm',
            build: desc.build || 'average',
            accessories: desc.accessories || [],
        };
    }
    generateFallbackDescription(agentProfile) {
        var _a, _b, _c, _d;
        // Rule-based fallback if LLM fails
        return {
            style: ((_a = agentProfile.tags) === null || _a === void 0 ? void 0 : _a.includes('anime')) ? 'anime' : 'realistic',
            gender: agentProfile.gender || 'neutral',
            species: agentProfile.breed ? 'animal' : 'human',
            bodyType: agentProfile.build || 'average',
            height: agentProfile.height || 'average',
            hair: {
                color: agentProfile.hairColor || 'brown',
                style: 'medium',
            },
            eyes: {
                color: agentProfile.eyeColor || 'brown',
            },
            clothing: agentProfile.profession ? `${agentProfile.profession} attire` : 'casual clothing',
            colorPalette: ((_b = agentProfile.colorScheme) === null || _b === void 0 ? void 0 : _b.primaryColor) && ((_c = agentProfile.colorScheme) === null || _c === void 0 ? void 0 : _c.secondaryColor)
                ? [agentProfile.colorScheme.primaryColor, agentProfile.colorScheme.secondaryColor]
                : ['#4A90E2', '#F5A623'],
            expressionBaseline: ((_d = agentProfile.personality) === null || _d === void 0 ? void 0 : _d.includes('energetic')) ? 'energetic' : 'calm',
            build: agentProfile.build || 'average',
            accessories: [],
        };
    }
}
exports.CharacterDescriptionGenerator = CharacterDescriptionGenerator;
exports.characterDescriptionGenerator = new CharacterDescriptionGenerator();
