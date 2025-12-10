import axios from 'axios';
import { AVATAR_CONFIG } from '../config/constants';

export interface CharacterDescription {
  style: 'anime' | 'realistic' | 'cartoon' | 'chibi' | 'robot' | 'fantasy';
  subcategory?: string;
  gender: 'male' | 'female' | 'neutral';
  species: 'human' | 'elf' | 'android' | 'animal' | 'creature';
  bodyType: 'slim' | 'average' | 'strong' | 'small';
  height: string;
  hair: {
    color: string;
    style: string;
  };
  eyes: {
    color: string;
  };
  clothing: string;
  colorPalette: string[];
  expressionBaseline: 'calm' | 'energetic' | 'cute' | 'dramatic';
  build: string;
  accessories?: string[];
}

export interface AgentProfile {
  name: string;
  displayName?: string;
  age?: number;
  gender?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  height?: string;
  build?: string;
  profession?: string;
  role?: string;
  personality?: string[];
  interests?: string[];
  breed?: string;
  colorScheme?: {
    primaryColor?: string;
    secondaryColor?: string;
    theme?: string;
  };
  tags?: string[];
}

export class CharacterDescriptionGenerator {
  /**
   * Generate character description from agent profile using LLM
   */
  async generateDescription(agentProfile: AgentProfile): Promise<CharacterDescription> {
    const prompt = this.buildPrompt(agentProfile);
    
    try {
      const description = await this.callLLM(prompt);
      return this.parseDescription(description);
    } catch (error) {
      console.error('[CharacterDescriptionGenerator] Error generating description:', error);
      // Fallback to rule-based generation
      return this.generateFallbackDescription(agentProfile);
    }
  }

  private buildPrompt(agentProfile: AgentProfile): string {
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

  private async callLLM(prompt: string): Promise<string> {
    if (AVATAR_CONFIG.LLM_PROVIDER === 'openai') {
      return this.callOpenAI(prompt);
    } else if (AVATAR_CONFIG.LLM_PROVIDER === 'claude') {
      return this.callClaude(prompt);
    } else {
      throw new Error(`Unsupported LLM provider: ${AVATAR_CONFIG.LLM_PROVIDER}`);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: AVATAR_CONFIG.LLM_MODEL,
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
      },
      {
        headers: {
          'Authorization': `Bearer ${AVATAR_CONFIG.LLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    return content;
  }

  private async callClaude(prompt: string): Promise<string> {
    // TODO: Implement Claude API call
    throw new Error('Claude provider not yet implemented');
  }

  private parseDescription(jsonString: string): CharacterDescription {
    try {
      // Remove markdown code blocks if present
      let cleaned = jsonString.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      return this.validateDescription(parsed);
    } catch (error) {
      console.error('[CharacterDescriptionGenerator] Error parsing description:', error);
      throw new Error(`Failed to parse character description: ${error}`);
    }
  }

  private validateDescription(desc: any): CharacterDescription {
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

  private generateFallbackDescription(agentProfile: AgentProfile): CharacterDescription {
    // Rule-based fallback if LLM fails
    return {
      style: agentProfile.tags?.includes('anime') ? 'anime' : 'realistic',
      gender: (agentProfile.gender as any) || 'neutral',
      species: agentProfile.breed ? 'animal' : 'human',
      bodyType: (agentProfile.build as any) || 'average',
      height: agentProfile.height || 'average',
      hair: {
        color: agentProfile.hairColor || 'brown',
        style: 'medium',
      },
      eyes: {
        color: agentProfile.eyeColor || 'brown',
      },
      clothing: agentProfile.profession ? `${agentProfile.profession} attire` : 'casual clothing',
      colorPalette: agentProfile.colorScheme?.primaryColor && agentProfile.colorScheme?.secondaryColor
        ? [agentProfile.colorScheme.primaryColor, agentProfile.colorScheme.secondaryColor]
        : ['#4A90E2', '#F5A623'],
      expressionBaseline: agentProfile.personality?.includes('energetic') ? 'energetic' : 'calm',
      build: agentProfile.build || 'average',
      accessories: [],
    };
  }
}

export const characterDescriptionGenerator = new CharacterDescriptionGenerator();

