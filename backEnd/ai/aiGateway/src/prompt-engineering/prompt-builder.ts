// src/prompt-engineering/prompt-builder.ts
// Builds enhanced prompts from character attributes and base system prompts

import { CharacterAttributes } from './character-attributes';

export interface PromptBuilderOptions {
  includeAppearance?: boolean;
  includePersonality?: boolean;
  includeBackground?: boolean;
  includeGoals?: boolean;
  style?: 'detailed' | 'concise' | 'minimal';
}

export class PromptBuilder {
  /**
   * Builds an enhanced system prompt for agent creation
   * Combines base system prompt with character attributes
   */
  static buildSystemPrompt(
    basePrompt: string,
    character: CharacterAttributes | undefined,
    options: PromptBuilderOptions = {}
  ): string {
    if (!character) {
      return basePrompt;
    }

    const sections: string[] = [];

    // Base prompt first
    if (basePrompt.trim()) {
      sections.push(basePrompt);
    }

    // Character identity section
    const identitySection = this.buildIdentitySection(character);
    if (identitySection) {
      sections.push(identitySection);
    }

    // Physical appearance (if enabled)
    if (options.includeAppearance !== false) {
      const appearanceSection = this.buildAppearanceSection(character, options.style);
      if (appearanceSection) {
        sections.push(appearanceSection);
      }
    }

    // Personality traits (if enabled)
    if (options.includePersonality !== false) {
      const personalitySection = this.buildPersonalitySection(character, options.style);
      if (personalitySection) {
        sections.push(personalitySection);
      }
    }

    // Background and story (if enabled)
    if (options.includeBackground !== false) {
      const backgroundSection = this.buildBackgroundSection(character, options.style);
      if (backgroundSection) {
        sections.push(backgroundSection);
      }
    }

    // Goals and motivations (if enabled)
    if (options.includeGoals !== false) {
      const goalsSection = this.buildGoalsSection(character, options.style);
      if (goalsSection) {
        sections.push(goalsSection);
      }
    }

    return sections.join('\n\n').trim();
  }

  /**
   * Builds a minimal context prompt to prepend to messages
   * Only includes DYNAMIC or CRITICAL REMINDER attributes
   * Static attributes should be in agent creation instructions, not repeated here
   */
  static buildMessageContext(
    character: CharacterAttributes | undefined,
    options: PromptBuilderOptions = {}
  ): string {
    if (!character) {
      return '';
    }

    const contextParts: string[] = [];

    // Only include DYNAMIC attributes that change per message
    // Current location (can change)
    if (character.currentLocation) {
      contextParts.push(`Current location: ${character.currentLocation}`);
    }

    // Communication style reminder (critical for consistency, but keep it minimal)
    // Only include if we want to reinforce it - most providers maintain this from system prompt
    if (options.includePersonality && (character.communicationStyle || character.speechPattern)) {
      const commReminder = this.buildMinimalCommunicationReminder(character);
      if (commReminder) {
        contextParts.push(commReminder);
      }
    }

    // Future: Add dynamic state like mood, recent events, etc.
    // if (character.currentMood) {
    //   contextParts.push(`Current mood: ${character.currentMood}`);
    // }

    return contextParts.length > 0 ? `[Context]\n${contextParts.join('\n')}\n` : '';
  }

  private static buildIdentitySection(character: CharacterAttributes, concise = false): string {
    const parts: string[] = [];

    if (character.name) {
      const fullName = [character.title, character.name].filter(Boolean).join(' ');
      parts.push(`You are ${fullName}${character.displayName ? ` (also known as ${character.displayName})` : ''}.`);
    }

    if (!concise) {
      if (character.age || character.ageRange) {
        const ageInfo = character.age ? `${character.age} years old` : character.ageRange;
        parts.push(`Age: ${ageInfo}`);
      }

      if (character.gender) {
        parts.push(`Gender: ${character.gender}`);
      }

      if (character.breed) {
        const breedInfo = [character.breed, character.subtype].filter(Boolean).join(' - ');
        parts.push(`Type: ${breedInfo}`);
      }

      if (character.nationality || character.ethnicity) {
        const originInfo = [character.nationality, character.ethnicity].filter(Boolean).join(', ');
        parts.push(`Origin: ${originInfo}`);
      }
    }

    if (character.profession || character.role) {
      const roleInfo = [character.profession, character.role].filter(Boolean).join(' / ');
      parts.push(`Role: ${roleInfo}`);
    }

    if (character.specialization) {
      parts.push(`Specialization: ${character.specialization}`);
    }

    if (character.organization) {
      parts.push(`Organization: ${character.organization}`);
    }

    return parts.join('\n');
  }

  private static buildAppearanceSection(
    character: CharacterAttributes,
    style: 'detailed' | 'concise' | 'minimal' = 'detailed'
  ): string {
    if (style === 'minimal') {
      return '';
    }

    const parts: string[] = [];

    if (character.height || character.build) {
      const physical = [character.height, character.build].filter(Boolean).join(', ');
      parts.push(`Physical: ${physical}`);
    }

    if (character.hairColor || character.eyeColor || character.skinTone) {
      const features = [
        character.hairColor ? `hair: ${character.hairColor}` : null,
        character.eyeColor ? `eyes: ${character.eyeColor}` : null,
        character.skinTone ? `skin: ${character.skinTone}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      if (features) {
        parts.push(`Appearance: ${features}`);
      }
    }

    if (character.distinguishingFeatures && character.distinguishingFeatures.length > 0) {
      parts.push(`Distinguishing features: ${character.distinguishingFeatures.join(', ')}`);
    }

    return parts.length > 0 ? `Physical Appearance:\n${parts.join('\n')}` : '';
  }

  private static buildPersonalitySection(
    character: CharacterAttributes,
    style: 'detailed' | 'concise' | 'minimal' = 'detailed'
  ): string {
    const parts: string[] = [];

    if (character.personality && character.personality.length > 0) {
      parts.push(`Personality traits: ${character.personality.join(', ')}`);
    }

    if (character.communicationStyle) {
      parts.push(`Communication style: ${character.communicationStyle}`);
    }

    if (character.speechPattern && style !== 'minimal') {
      parts.push(`Speech pattern: ${character.speechPattern}`);
    }

    if (character.relationshipToUser) {
      parts.push(`Relationship to user: ${character.relationshipToUser}`);
    }

    return parts.length > 0 ? `Personality:\n${parts.join('\n')}` : '';
  }

  private static buildBackgroundSection(
    character: CharacterAttributes,
    style: 'detailed' | 'concise' | 'minimal' = 'detailed'
  ): string {
    if (style === 'minimal') {
      return '';
    }

    const parts: string[] = [];

    if (character.backstory) {
      parts.push(`Backstory: ${character.backstory}`);
    }

    if (character.origin && style === 'detailed') {
      parts.push(`Origin: ${character.origin}`);
    }

    if (character.abilities && character.abilities.length > 0 && style === 'detailed') {
      parts.push(`Abilities: ${character.abilities.join(', ')}`);
    }

    if (character.skills && character.skills.length > 0 && style === 'detailed') {
      parts.push(`Skills: ${character.skills.join(', ')}`);
    }

    if (character.limitations && character.limitations.length > 0 && style === 'detailed') {
      parts.push(`Limitations: ${character.limitations.join(', ')}`);
    }

    return parts.length > 0 ? `Background:\n${parts.join('\n')}` : '';
  }

  private static buildGoalsSection(
    character: CharacterAttributes,
    style: 'detailed' | 'concise' | 'minimal' = 'detailed'
  ): string {
    if (style === 'minimal') {
      return '';
    }

    const parts: string[] = [];

    if (character.goals && character.goals.length > 0) {
      parts.push(`Goals: ${character.goals.join(', ')}`);
    }

    if (character.interests && character.interests.length > 0 && style === 'detailed') {
      parts.push(`Interests: ${character.interests.join(', ')}`);
    }

    if (character.fears && character.fears.length > 0 && style === 'detailed') {
      parts.push(`Fears: ${character.fears.join(', ')}`);
    }

    return parts.length > 0 ? `Motivations:\n${parts.join('\n')}` : '';
  }

  private static buildCommunicationReminder(character: CharacterAttributes): string {
    const parts: string[] = [];

    if (character.communicationStyle) {
      parts.push(`Communication style: ${character.communicationStyle}`);
    }

    if (character.speechPattern) {
      parts.push(`Speech pattern: ${character.speechPattern}`);
    }

    return parts.length > 0 ? `Communication:\n${parts.join('\n')}` : '';
  }

  /**
   * Minimal communication reminder - just the essentials for message context
   */
  private static buildMinimalCommunicationReminder(character: CharacterAttributes): string {
    // Only include speech pattern if it's critical (e.g., uses specific dialect)
    // Communication style is usually maintained by the system prompt
    if (character.speechPattern && character.speechPattern.length > 0) {
      return `Remember: ${character.speechPattern}`;
    }
    return '';
  }
}

