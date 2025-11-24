import { Alert } from 'react-native';
import { BreedType, Gender } from '../constants/agentConstants';
import { AgentFormData } from '../types/agentTypes';

export const validateAgentForm = (
  formData: AgentFormData,
  customBreed: string,
  customGender: string,
  customProfession: string
): boolean => {
  if (!formData.name.trim()) {
    Alert.alert('Validation Error', 'Name is required');
    return false;
  }
  if (!formData.profession.trim()) {
    Alert.alert('Validation Error', 'Profession is required');
    return false;
  }
  if (!formData.breed) {
    Alert.alert('Validation Error', 'Breed/Type is required');
    return false;
  }
  if (!formData.gender) {
    Alert.alert('Validation Error', 'Gender is required');
    return false;
  }
  if (formData.breed === BreedType.OTHER && !customBreed.trim()) {
    Alert.alert('Validation Error', 'Please specify the breed/type');
    return false;
  }
  if (formData.gender === Gender.OTHER && !customGender.trim()) {
    Alert.alert('Validation Error', 'Please specify the gender');
    return false;
  }
  if (formData.profession === 'other' && !customProfession.trim()) {
    Alert.alert('Validation Error', 'Please specify the profession');
    return false;
  }
  return true;
};

