// Agent-related TypeScript types and interfaces

export interface AgentFormData {
  // Basic fields
  name: string;
  profession: string;
  breed: string;
  gender: string;
  age: string;
  
  // Advanced - Profile attributes
  displayName: string;
  title: string;
  ageRange: string;
  nationality: string;
  ethnicity: string;
  specialization: string;
  organization: string;
  role: string;
  communicationStyle: string;
  speechPattern: string;
  backstory: string;
  personality: string[];
  
  // Provider configuration
  modelProvider: string;
  modelName: string;
  systemPrompt: string;
  apiKey: string;
  endpoint: string;
  voiceId: string;
  rateLimits: {
    rpm: number;
    tpm: number;
  };
}

