// Agent-related constants and enums

export const BreedType = {
  HUMAN: 'human',
  HUMANOID: 'humanoid',
  GOBLIN: 'goblin',
  ANGEL: 'angel',
  DEMON: 'demon',
  ANIMAL: 'animal',
  ROBOT: 'robot',
  ANDROID: 'android',
  ANIME: 'anime',
  FANTASY_CREATURE: 'fantasy-creature',
  MYTHICAL: 'mythical',
  ALIEN: 'alien',
  HYBRID: 'hybrid',
  OTHER: 'other',
} as const;

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  NON_BINARY: 'non-binary',
  GENDERFLUID: 'genderfluid',
  AGENDER: 'agender',
  OTHER: 'other',
} as const;

export const ModelProvider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  COHERE: 'cohere',
  LOCAL: 'local',
  CUSTOM: 'custom',
} as const;

export const commonProfessions = [
  'Doctor',
  'Engineer',
  'Teacher',
  'Artist',
  'Writer',
  'Scientist',
  'Warrior',
  'Mage',
  'Merchant',
  'Scholar',
  'other',
];

export const formatBreedLabel = (breed: string): string => {
  return breed.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const formatGenderLabel = (gender: string): string => {
  return gender.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

