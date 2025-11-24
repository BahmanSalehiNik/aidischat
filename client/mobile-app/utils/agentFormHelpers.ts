import { agentsApi } from './api';
import { AgentFormData } from '../types/agentTypes';
import { BreedType, Gender } from '../constants/agentConstants';

export const prepareProfileData = (
  formData: AgentFormData,
  customBreed: string,
  customGender: string,
  customProfession: string
): any => {
  return {
    name: formData.name.trim(),
    profession: formData.profession === 'other' ? customProfession.trim() : formData.profession,
    breed: formData.breed === BreedType.OTHER ? customBreed.trim() : formData.breed,
    gender: formData.gender === Gender.OTHER ? customGender.trim() : formData.gender,
    age: formData.age ? parseInt(formData.age, 10) : undefined,
    displayName: formData.displayName.trim() || undefined,
    title: formData.title.trim() || undefined,
    ageRange: formData.ageRange || undefined,
    nationality: formData.nationality.trim() || undefined,
    ethnicity: formData.ethnicity.trim() || undefined,
    specialization: formData.specialization.trim() || undefined,
    organization: formData.organization.trim() || undefined,
    role: formData.role || undefined,
    communicationStyle: formData.communicationStyle || undefined,
    speechPattern: formData.speechPattern.trim() || undefined,
    backstory: formData.backstory.trim() || undefined,
    personality: formData.personality.length > 0 ? formData.personality : undefined,
  };
};

export const prepareAgentData = (formData: AgentFormData, agentProfileId: string): any => {
  const agentData: any = {
    agentProfileId,
    modelProvider: formData.modelProvider,
    modelName: formData.modelName,
    systemPrompt: formData.systemPrompt.trim() || undefined,
    voiceId: formData.voiceId.trim() || undefined,
    rateLimits: formData.rateLimits,
    privacy: {
      shareMessagesWithOwner: true,
    },
  };

  // Only include API key and endpoint if provided
  if (formData.apiKey.trim()) {
    agentData.apiKey = formData.apiKey.trim();
  }
  if (formData.endpoint.trim()) {
    agentData.endpoint = formData.endpoint.trim();
  }

  return agentData;
};

export const submitAgentForm = async (
  formData: AgentFormData,
  customBreed: string,
  customGender: string,
  customProfession: string
): Promise<{ profileId: string; agentId: string }> => {
  const profileData = prepareProfileData(formData, customBreed, customGender, customProfession);
  const profileResponse = await agentsApi.createProfile(profileData);
  const agentProfileId = profileResponse.id;

  const agentData = prepareAgentData(formData, agentProfileId);
  const agentResponse = await agentsApi.createAgent(agentData);

  // Handle response structure: backend returns { agent, agentProfile, provisioning }
  // but we need to extract the agent ID
  const agentId = (agentResponse as any).agent?.id || (agentResponse as any).id;

  return {
    profileId: agentProfileId,
    agentId: agentId || (agentResponse as any).agentId,
  };
};

export const updateAgentForm = async (
  agentId: string,
  profileId: string,
  formData: AgentFormData,
  customBreed: string,
  customGender: string,
  customProfession: string
): Promise<void> => {
  const profileData = prepareProfileData(formData, customBreed, customGender, customProfession);
  await agentsApi.updateProfile(profileId, profileData);

  const agentData = prepareAgentData(formData, profileId);
  await agentsApi.updateAgent(agentId, agentData);
};

