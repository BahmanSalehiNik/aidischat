# Prompt Engineering Module

## Overview

The prompt engineering module is responsible for enhancing prompts with character attributes that aren't directly supported by provider APIs (OpenAI, Anthropic, etc.). It ensures that all character traits, personality, appearance, and background information are properly injected into prompts for consistent character behavior.

## Architecture

```
Character Attributes (from agent metadata)
    ↓
PromptBuilder
    ↓
Enhanced System Prompt (for agent creation)
    ↓
Provider API (OpenAI Assistants, Anthropic, etc.)
```

```
Character Attributes (from agent metadata)
    ↓
PromptBuilder
    ↓
Message Context (injected at message start)
    ↓
User Message + Context
    ↓
Provider API
```

## Features

### 1. System Prompt Enhancement
- Combines base system prompt with character attributes
- Includes identity, appearance, personality, background, and goals
- Used during agent creation to set up the character

### 2. Message Context Injection
- Injects lighter character context at the beginning of each message
- Focuses on communication style and current state
- Keeps character behavior consistent across conversations

### 3. Flexible Configuration
- **Style options**: `detailed`, `concise`, `minimal`
- **Section toggles**: Control which character aspects to include
- **Provider-agnostic**: Works with all AI providers

## Usage

### Agent Creation

```typescript
import { PromptBuilder, CharacterAttributes } from './prompt-engineering';

const enhancedInstructions = PromptBuilder.buildSystemPrompt(
  baseSystemPrompt,
  characterAttributes,
  {
    includeAppearance: true,
    includePersonality: true,
    includeBackground: true,
    includeGoals: true,
    style: 'detailed',
  }
);
```

### Message Generation

```typescript
// Build message context
const messageContext = PromptBuilder.buildMessageContext(
  characterAttributes,
  {
    includeAppearance: false,
    includePersonality: true,
    style: 'concise',
  }
);

// Prepend to message
const messageWithContext = messageContext 
  ? `${messageContext}\n\nUser message: ${userMessage}`
  : userMessage;
```

## Character Attributes

The module supports all character attributes from the agent character model:

- **Identity**: name, displayName, title
- **Demographics**: age, ageRange, gender, nationality, ethnicity
- **Appearance**: breed, subtype, height, build, hairColor, eyeColor, skinTone, distinguishingFeatures
- **Profession**: profession, role, specialization, organization
- **Personality**: personality traits, communicationStyle, speechPattern
- **Background**: backstory, origin, currentLocation, goals, fears, interests, abilities, skills, limitations
- **Relationships**: relationshipToUser

## Benefits

1. **Separation of Concerns**: Prompt logic isolated from provider code
2. **Reusability**: Same module for agent creation and message generation
3. **Consistency**: Character traits always present in prompts
4. **Flexibility**: Easy to adjust prompt style and content
5. **Extensibility**: Can add new prompt engineering techniques (few-shot, chain-of-thought, etc.)

## Future Enhancements

- [ ] Template system for custom prompt formats
- [ ] Few-shot example injection
- [ ] Chain-of-thought prompting
- [ ] Dynamic context based on conversation history
- [ ] Mood/emotion state injection
- [ ] Multi-language prompt support

