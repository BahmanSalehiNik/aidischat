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

    // Character identity section FIRST - this is critical for OpenAI Assistants API
    // The name and identity must be at the very beginning
    const identitySection = this.buildIdentitySection(character);
    if (identitySection && identitySection.trim()) {
      sections.push(identitySection);
    } else {
      // Fallback: ensure name is always included in the exact format that works
      const name = character.name || character.displayName || 'this character';
      const fullName = [character.title, name].filter(Boolean).join(' ');
      // Use lowercase format that matches working example
      sections.push(`your name is ${fullName}.`);
    }
    
    // Double-check: if name is not in the identity section, add it explicitly
    const name = character.name || character.displayName;
    if (name && identitySection && !identitySection.toLowerCase().includes(name.toLowerCase())) {
      const fullName = [character.title, name].filter(Boolean).join(' ');
      // Prepend name explicitly if it's missing
      sections[0] = `your name is ${fullName}. ${sections[0]}`;
    }

    // Base prompt after identity (if provided)
    if (basePrompt.trim()) {
      sections.push(basePrompt);
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

    // Join sections with double newlines, but ensure identity comes first
    // For OpenAI Assistants API, a more natural flow works better
    // Join sections with single newline for better flow
    // The identity section should be the first line and most prominent
    return sections.join('\n').trim();
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
    // Always include name prominently - use name, displayName, or a fallback
    const name = character.name || character.displayName || 'this character';
    const fullName = [character.title, name].filter(Boolean).join(' ');
    
    // Build a single, natural, flowing sentence matching the user's working format:
    // "you are an engineer from Brazil your name is Helen and you are 30 years old"
    // Use lowercase for natural flow, name must be prominent
    
    const parts: string[] = [];
    
    // Start with profession/role if available
    if (character.profession || character.role) {
      const roleInfo = character.profession || character.role;
      parts.push(`you are ${roleInfo}`);
      if (character.specialization) {
        parts.push(`specializing in ${character.specialization}`);
      }
    }
    
    // CRITICAL: Name must be very clear and prominent
    // Use lowercase "your name is" to match natural flow
    if (character.profession || character.role) {
      parts.push(`your name is ${fullName}`);
    } else {
      // If no profession, start with name
      parts.push(`your name is ${fullName}`);
    }
    
    // Add origin/nationality
    if (character.nationality || character.ethnicity) {
      const originInfo = [character.nationality, character.ethnicity].filter(Boolean).join(', ');
      parts.push(`from ${originInfo}`);
    }
    
    // Add age
    if (character.age || character.ageRange) {
      const ageInfo = character.age ? `${character.age} years old` : character.ageRange;
      parts.push(`you are ${ageInfo}`);
    }
    
    // Add gender if provided
    if (character.gender) {
      parts.push(`you are ${character.gender}`);
    }
    
    // Add breed/type if provided
    if (character.breed) {
      const breedInfo = [character.breed, character.subtype].filter(Boolean).join(' - ');
      parts.push(`you are a ${breedInfo}`);
    }
    
    // Join all parts into a single flowing sentence (lowercase, natural)
    let identitySentence = parts.join(' ');
    
    // Capitalize first letter only
    if (identitySentence.length > 0) {
      identitySentence = identitySentence.charAt(0).toUpperCase() + identitySentence.slice(1);
    }
    
    // Add display name if different from name (as a separate note)
    if (character.displayName && character.name && character.displayName !== character.name) {
      identitySentence += `. You are also known as ${character.displayName}`;
    }
    
    // Add organization if provided
    if (character.organization) {
      identitySentence += `. You work for ${character.organization}`;
    }
    
    // End with period
    identitySentence += '.';
    
    return identitySentence;
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

