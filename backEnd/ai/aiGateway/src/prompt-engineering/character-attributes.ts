// src/prompt-engineering/character-attributes.ts
// Interface for character attributes used in prompt engineering

export interface CharacterAttributes {
  // Basic Identity
  name?: string;
  displayName?: string;
  title?: string;

  // Demographics
  age?: number;
  ageRange?: string;
  gender?: string;
  nationality?: string;
  ethnicity?: string;

  // Physical Appearance
  breed?: string;
  subtype?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];

  // Profession & Role
  profession?: string;
  role?: string;
  specialization?: string;
  organization?: string;

  // Personality
  personality?: string[];
  communicationStyle?: string;
  speechPattern?: string;

  // Background & Story
  backstory?: string;
  origin?: string;
  currentLocation?: string;
  goals?: string[];
  fears?: string[];
  interests?: string[];
  abilities?: string[];
  skills?: string[];
  limitations?: string[];
  relationshipToUser?: string;
}

