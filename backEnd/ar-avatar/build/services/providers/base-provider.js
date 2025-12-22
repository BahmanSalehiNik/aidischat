"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModelProvider = void 0;
/**
 * Base class for model providers with common functionality
 */
class BaseModelProvider {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    isAvailable() {
        return !!this.apiKey && !!this.baseUrl;
    }
    /**
     * Build a prompt from character description (common implementation)
     */
    buildPrompt(description) {
        const parts = [];
        // Style and appearance
        parts.push(`${description.style} style character`);
        if (description.subcategory) {
            parts.push(description.subcategory);
        }
        // Gender and species
        parts.push(`${description.gender} ${description.species}`);
        // Body type
        parts.push(`${description.bodyType} body type`);
        if (description.height) {
            parts.push(`${description.height} height`);
        }
        // Hair
        if (description.hair) {
            parts.push(`${description.hair.color} ${description.hair.style} hair`);
        }
        // Eyes
        if (description.eyes) {
            parts.push(`${description.eyes.color} eyes`);
        }
        // Clothing
        if (description.clothing) {
            parts.push(`wearing ${description.clothing}`);
        }
        // Accessories
        if (description.accessories && description.accessories.length > 0) {
            parts.push(`with ${description.accessories.join(', ')}`);
        }
        // Expression
        if (description.expressionBaseline) {
            parts.push(`${description.expressionBaseline} expression`);
        }
        return parts.join(', ');
    }
}
exports.BaseModelProvider = BaseModelProvider;
