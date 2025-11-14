# Character Attribute Separation Strategy

## Overview

This document outlines which character attributes should be included in **one-time agent creation instructions** vs **per-message prompt engineering** to optimize token usage and maintain consistency.

## One-Time Agent Creation Instructions

These attributes are **static** and should be included **once** during agent/assistant creation. They become part of the agent's persistent identity.

### ✅ Included in Agent Creation:

1. **Identity** (Static)
   - name, displayName, title
   - age, ageRange, gender
   - nationality, ethnicity

2. **Physical Appearance** (Static)
   - breed, subtype
   - height, build
   - hairColor, eyeColor, skinTone
   - distinguishingFeatures

3. **Profession & Role** (Static)
   - profession, role
   - specialization, organization

4. **Personality** (Static)
   - personality traits array
   - communicationStyle
   - speechPattern
   - relationshipToUser

5. **Background** (Static)
   - backstory
   - origin
   - abilities, skills, limitations
   - goals (initial)
   - interests (initial)
   - fears (initial)

**Why:** These don't change per message and are part of the character's core identity. Including them once in the assistant instructions (OpenAI) or system prompt (Anthropic/Local) is sufficient.

## Per-Message Prompt Engineering

These attributes are **dynamic** or need **reinforcement** and should be included with each message.

### ✅ Included in Message Context:

1. **Dynamic State** (Changes per message)
   - currentLocation (can change)
   - currentMood (if implemented - changes)
   - recentEvents (if implemented - changes)

2. **Critical Reminders** (Optional, minimal)
   - speechPattern (only if very specific/critical)
   - communicationStyle (only if needs reinforcement)

**Why:** These change or need to be reinforced to maintain consistency. Keep this section **minimal** to avoid token bloat.

## Provider-Specific Behavior

### OpenAI (Assistants API)
- **Agent Creation:** Full detailed prompt with all static attributes → stored in assistant
- **Message Generation:** 
  - System prompt: Base prompt (assistant already has full details)
  - Message context: Only dynamic attributes (location, etc.)

### Anthropic / Local / Custom
- **Agent Creation:** Full detailed prompt with all static attributes → stored in our system
- **Message Generation:**
  - System prompt: Enhanced prompt with all static attributes (needed each time)
  - Message context: Only dynamic attributes (location, etc.)

## Token Optimization

### Before Optimization:
- Agent creation: ~500-1000 tokens (full character)
- Each message: ~500-1000 tokens (repeating full character)

### After Optimization:
- Agent creation: ~500-1000 tokens (full character) ✅
- Each message: ~10-50 tokens (only dynamic attributes) ✅

**Savings:** ~450-950 tokens per message!

## Example

### Agent Creation (One-Time):
```
You are Sir Lancelot, a brave knight of the Round Table.
Age: 35 years old
Type: human - knight
Role: Guardian / Knight
Personality traits: brave, loyal, honorable, chivalrous
Communication style: formal, ancient
Speech pattern: Uses "thou" and "thee", speaks with medieval formality
Backstory: A legendary knight who has served King Arthur...
Goals: Protect the innocent, uphold chivalry
[Full detailed character description]
```

### Message Context (Per-Message):
```
[Context]
Current location: Camelot Castle
```

**Result:** Character identity is maintained, but each message is minimal and efficient.

## Best Practices

1. ✅ **Static attributes → Agent creation only**
2. ✅ **Dynamic attributes → Message context**
3. ✅ **Keep message context minimal** (< 50 tokens ideally)
4. ✅ **Use provider capabilities** (OpenAI assistants store instructions)
5. ✅ **Avoid redundancy** (don't repeat what's already in system prompt)

