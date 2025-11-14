# Agent Character Attributes Design

## Overview
Each user can have multiple AI agents/characters. Each agent needs character attributes to define their personality, appearance, and behavior.

## Suggested Attributes

### 1. **Basic Identity**
- **name** (string, required): The agent's name (e.g., "Bob", "Mark")
- **displayName** (string, optional): Alternative display name or nickname
- **title** (string, optional): Title or honorific (e.g., "Dr.", "Sir", "Lord")

### 2. **Demographics**
- **age** (number, optional): Age in years (e.g., 25, 150, 1000)
- **ageRange** (enum, optional): Age category for flexibility
  - Options: `['child', 'teen', 'young-adult', 'adult', 'middle-aged', 'elderly', 'ancient', 'ageless']`
- **gender** (enum, optional): Gender identity
  - Options: `['male', 'female', 'non-binary', 'genderfluid', 'agender', 'other']`
- **nationality** (string, optional): Nationality or origin (e.g., "American", "Japanese", "Elven")
- **ethnicity** (string, optional): Ethnic background (e.g., "Caucasian", "Asian", "Elven")

### 3. **Physical Appearance**
- **breed/type** (enum, required): Species or type classification
  - Options: 
    - `'human'` - Standard human
    - `'humanoid'` - Human-like but not human (elves, dwarves, etc.)
    - `'goblin'` - Goblinoid creatures
    - `'angel'` - Celestial beings
    - `'demon'` - Infernal beings
    - `'animal'` - Animal-like (anthropomorphic animals)
    - `'robot'` - Mechanical/cybernetic
    - `'android'` - Human-like robot
    - `'anime'` - Anime-style character
    - `'fantasy-creature'` - Dragons, unicorns, etc.
    - `'mythical'` - Mythological beings
    - `'alien'` - Extraterrestrial
    - `'hybrid'` - Mixed types
    - `'other'` - Custom type
- **subtype** (string, optional): More specific classification (e.g., "elf", "dwarf", "cat-person", "cyborg")
- **height** (string, optional): Height description (e.g., "5'10\"", "tall", "short")
- **build** (enum, optional): Body type
  - Options: `['slim', 'athletic', 'average', 'muscular', 'curvy', 'heavy', 'petite', 'tall', 'other']`
- **hairColor** (string, optional): Hair color (e.g., "blonde", "black", "rainbow")
- **eyeColor** (string, optional): Eye color (e.g., "blue", "green", "glowing-red")
- **skinTone** (string, optional): Skin tone or texture (e.g., "pale", "tan", "metallic", "scaled")
- **distinguishingFeatures** (array of strings, optional): Notable features (e.g., ["wings", "horns", "tail", "glowing eyes"])

### 4. **Profession & Role**
- **profession** (string, optional): Primary profession (e.g., "Software Engineer", "Wizard", "Knight")
- **role** (enum, optional): General role category
  - Options: `['assistant', 'companion', 'mentor', 'adversary', 'neutral', 'guardian', 'entertainer', 'educator', 'other']`
- **specialization** (string, optional): Area of expertise (e.g., "Machine Learning", "Dark Magic", "Combat")
- **organization** (string, optional): Affiliation (e.g., "Google", "Knights of the Round Table")

### 5. **Personality Traits**
- **personality** (array of strings, optional): Key personality traits
  - Options: `['friendly', 'serious', 'humorous', 'sarcastic', 'wise', 'playful', 'mysterious', 'brave', 'cautious', 'curious', 'loyal', 'independent', 'creative', 'analytical', 'empathetic', 'stoic', 'energetic', 'calm', 'optimistic', 'pessimistic', 'chaotic', 'orderly']`
- **communicationStyle** (enum, optional): How they communicate
  - Options: `['formal', 'casual', 'technical', 'poetic', 'slang', 'ancient', 'modern', 'mixed']`
- **speechPattern** (string, optional): Unique speech patterns (e.g., "uses 'thou' and 'thee'", "speaks in riddles")

### 6. **Background & Story**
- **backstory** (string, optional): Character background story (max 2000 chars)
- **origin** (string, optional): Place of origin (e.g., "Tokyo, Japan", "The Feywild", "Mars Colony 7")
- **currentLocation** (string, optional): Where they currently are
- **goals** (array of strings, optional): Character goals or motivations
- **fears** (array of strings, optional): Things they fear or avoid
- **interests** (array of strings, optional): Hobbies and interests

### 7. **Abilities & Powers**
- **abilities** (array of strings, optional): Special abilities (e.g., ["flight", "telepathy", "super-strength"])
- **skills** (array of strings, optional): Learned skills (e.g., ["sword-fighting", "programming", "magic"])
- **limitations** (array of strings, optional): Weaknesses or limitations

### 8. **Relationships**
- **relationshipToUser** (enum, optional): How they relate to the user
  - Options: `['friend', 'mentor', 'assistant', 'companion', 'rival', 'neutral', 'guardian', 'student', 'other']`

### 9. **Visual & Media**
- **avatarUrl** (string, optional): URL to character avatar/image
- **avatarPublicId** (string, optional): Cloud storage public ID for avatar
- **colorScheme** (object, optional): Preferred colors
  - `primaryColor` (string): Main color
  - `secondaryColor` (string): Accent color
  - `theme` (enum): `['light', 'dark', 'colorful', 'monochrome', 'neon', 'pastel']`

### 10. **Metadata**
- **tags** (array of strings, optional): Searchable tags (e.g., ["fantasy", "tech-savvy", "comedy"])
- **isPublic** (boolean, default: false): Whether character can be shared/discovered
- **isActive** (boolean, default: true): Whether character is currently active
- **createdAt** (Date, auto): Creation timestamp
- **updatedAt** (Date, auto): Last update timestamp

## Recommended Schema Structure

### Option 1: Extend Agent Model
Add character attributes directly to the `Agent` model.

### Option 2: Create AgentCharacter Model (Recommended)
Create a separate `AgentCharacter` model that references `Agent.id`. This keeps character data separate from technical profile data.

**Benefits:**
- Separation of concerns (character vs. technical profile)
- Easier to update character without affecting technical config
- Better for future features (character marketplace, sharing, etc.)

## Implementation Notes

1. **Required Fields**: Only `name` and `breed/type` should be required initially
2. **Validation**: Add enum validation for all enum fields
3. **Indexing**: Index `ownerUserId`, `name`, `breed/type`, `isPublic` for queries
4. **Default Values**: Provide sensible defaults for optional fields
5. **Character Limit**: Enforce reasonable limits on text fields (e.g., backstory max 2000 chars)
6. **Subscription Limits**: Enforce agent count limits based on user subscription (2 for free tier)

## Example Agent Character

```json
{
  "name": "Bob",
  "displayName": "Bob the Builder",
  "age": 35,
  "ageRange": "adult",
  "gender": "male",
  "nationality": "American",
  "breed": "human",
  "profession": "Software Engineer",
  "role": "assistant",
  "specialization": "Machine Learning",
  "personality": ["friendly", "analytical", "curious"],
  "communicationStyle": "casual",
  "backstory": "A software engineer with 10 years of experience...",
  "avatarUrl": "https://...",
  "isPublic": false,
  "isActive": true
}
```

