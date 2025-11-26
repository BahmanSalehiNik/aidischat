import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BreedType, Gender, ModelProvider, formatBreedLabel, formatGenderLabel } from '../../constants/agentConstants';
import { AgentFormData } from '../../types/agentTypes';
import { validateAgentForm } from '../../utils/agentValidation';
import { submitAgentForm } from '../../utils/agentFormHelpers';
import { PickerModal } from '../../components/agents/PickerModal';
import { FormField } from '../../components/agents/FormField';
import { ProfessionChips } from '../../components/agents/ProfessionChips';
import { createAgentStyles as styles } from '../../styles/agent/createAgentStyles';

const getInitialFormData = (): AgentFormData => ({
  name: '',
  profession: '',
  breed: '',
  gender: '',
  age: '',
  displayName: '',
  title: '',
  ageRange: '',
  nationality: '',
  ethnicity: '',
  specialization: '',
  organization: '',
  role: '',
  communicationStyle: '',
  speechPattern: '',
  backstory: '',
  personality: [],
  modelProvider: ModelProvider.OPENAI,
  modelName: 'gpt-4o',
  systemPrompt: '',
  apiKey: '',
  endpoint: '',
  voiceId: '',
  rateLimits: {
    rpm: 60,
    tpm: 1000,
  },
});

export default function CreateAgentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBreedPicker, setShowBreedPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [customBreed, setCustomBreed] = useState('');
  const [customGender, setCustomGender] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [formData, setFormData] = useState<AgentFormData>(getInitialFormData());
  const [isMounted, setIsMounted] = useState(false);

  // On iOS, ensure component is fully mounted before allowing input
  useEffect(() => {
    if (Platform.OS === 'ios') {
      let timer: NodeJS.Timeout;
      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        timer = setTimeout(() => {
          setIsMounted(true);
        }, 150);
      });
      return () => {
        interactionHandle.cancel();
        if (timer) clearTimeout(timer);
      };
    } else {
      setIsMounted(true);
    }
  }, []);

  const updateField = (field: keyof AgentFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!validateAgentForm(formData, customBreed, customGender, customProfession)) {
      return;
    }

    setLoading(true);
    try {
      await submitAgentForm(formData, customBreed, customGender, customProfession);
      Alert.alert('Success', 'Agent created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      Alert.alert('Error', error?.message || 'Failed to create agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const breedOptions = Object.entries(BreedType).map(([key, value]) => ({
    key: key.replace(/_/g, ' '),
    value,
  }));

  const genderOptions = Object.entries(Gender).map(([key, value]) => ({
    key: key.replace(/_/g, ' '),
    value,
  }));

  const providerOptions = Object.entries(ModelProvider).map(([key, value]) => ({
    key: key.replace(/_/g, ' '),
    value,
  }));

  const getBreedDisplayText = () => {
    if (formData.breed === BreedType.OTHER) {
      return customBreed || 'Other (specify)';
    }
    if (formData.breed) {
      return formatBreedLabel(formData.breed);
    }
    return 'Select breed/type';
  };

  const getGenderDisplayText = () => {
    if (formData.gender === Gender.OTHER) {
      return customGender || 'Other (specify)';
    }
    if (formData.gender) {
      return formatGenderLabel(formData.gender);
    }
    return 'Select gender';
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Agent</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basic Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <FormField
            label="Name"
            required
            placeholder="Enter agent name"
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
            maxLength={50}
            editable={isMounted}
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Breed/Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBreedPicker(true)}
            >
              <Text style={[styles.pickerText, !formData.breed && styles.placeholderText]}>
                {getBreedDisplayText()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
            {formData.breed === BreedType.OTHER && (
              <FormField
                label=""
                placeholder="Specify breed/type"
                value={customBreed}
                onChangeText={setCustomBreed}
                maxLength={50}
                style={styles.marginTop}
                editable={isMounted}
              />
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Gender *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowGenderPicker(true)}
            >
              <Text style={[styles.pickerText, !formData.gender && styles.placeholderText]}>
                {getGenderDisplayText()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
            {formData.gender === Gender.OTHER && (
              <FormField
                label=""
                placeholder="Specify gender"
                value={customGender}
                onChangeText={setCustomGender}
                maxLength={50}
                style={styles.marginTop}
                editable={isMounted}
              />
            )}
          </View>

          <FormField
            label="Age"
            placeholder="Enter age (optional)"
            value={formData.age}
            onChangeText={(value) => updateField('age', value)}
            keyboardType="number-pad"
            editable={isMounted}
          />

          <ProfessionChips
            selectedProfession={formData.profession}
            onSelect={(prof) => updateField('profession', prof)}
            customProfession={customProfession}
            onCustomChange={setCustomProfession}
          />
        </View>

        {/* Advanced Section Accordion */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.accordionTitle}>Advanced Settings</Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.subsectionTitle}>Agent Profile</Text>

            <FormField
              label="Display Name"
              placeholder="Alternative name/nickname"
              value={formData.displayName}
              onChangeText={(value) => updateField('displayName', value)}
              maxLength={50}
              editable={isMounted}
            />

            <FormField
              label="Title"
              placeholder="e.g., Dr., Sir, Lord"
              value={formData.title}
              onChangeText={(value) => updateField('title', value)}
              maxLength={50}
              editable={isMounted}
            />

            <FormField
              label="Nationality"
              placeholder="Enter nationality"
              value={formData.nationality}
              onChangeText={(value) => updateField('nationality', value)}
              maxLength={50}
              editable={isMounted}
            />

            <FormField
              label="Ethnicity"
              placeholder="Enter ethnicity"
              value={formData.ethnicity}
              onChangeText={(value) => updateField('ethnicity', value)}
              maxLength={50}
              editable={isMounted}
            />

            <FormField
              label="Specialization"
              placeholder="Enter specialization"
              value={formData.specialization}
              onChangeText={(value) => updateField('specialization', value)}
              maxLength={100}
              editable={isMounted}
            />

            <FormField
              label="Organization"
              placeholder="Enter organization"
              value={formData.organization}
              onChangeText={(value) => updateField('organization', value)}
              maxLength={100}
              editable={isMounted}
            />

            <FormField
              label="Speech Pattern"
              placeholder="Describe speech pattern (max 500 chars)"
              value={formData.speechPattern}
              onChangeText={(value) => updateField('speechPattern', value)}
              multiline
              numberOfLines={3}
              maxLength={500}
              style={styles.textArea}
              editable={isMounted}
            />

            <FormField
              label="Backstory"
              placeholder="Enter backstory (max 2000 chars)"
              value={formData.backstory}
              onChangeText={(value) => updateField('backstory', value)}
              multiline
              numberOfLines={5}
              maxLength={2000}
              style={styles.textArea}
              editable={isMounted}
            />

            <View style={styles.separator} />

            <Text style={styles.subsectionTitle}>Provider Configuration</Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Model Provider</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowProviderPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {providerOptions.find((opt) => opt.value === formData.modelProvider)?.key ||
                    formData.modelProvider}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <FormField
              label="Model Name"
              placeholder="e.g., gpt-4o, claude-3-opus"
              value={formData.modelName}
              onChangeText={(value) => updateField('modelName', value)}
              editable={isMounted}
            />

            <FormField
              label="System Prompt"
              placeholder="Enter system prompt for the agent"
              value={formData.systemPrompt}
              onChangeText={(value) => updateField('systemPrompt', value)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              editable={isMounted}
            />

            <FormField
              label="API Key (optional)"
              placeholder="Provider API key (if not using default)"
              value={formData.apiKey}
              onChangeText={(value) => updateField('apiKey', value)}
              secureTextEntry
              autoCapitalize="none"
              editable={isMounted}
            />

            <FormField
              label="Endpoint (for local/custom)"
              placeholder="e.g., http://localhost:8000"
              value={formData.endpoint}
              onChangeText={(value) => updateField('endpoint', value)}
              autoCapitalize="none"
              editable={isMounted}
            />

            <FormField
              label="Voice ID"
              placeholder="Voice identifier (optional)"
              value={formData.voiceId}
              onChangeText={(value) => updateField('voiceId', value)}
              editable={isMounted}
            />

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Rate Limits</Text>
              <View style={styles.rateLimitRow}>
                <View style={styles.rateLimitField}>
                  <Text style={styles.rateLimitLabel}>RPM</Text>
                  <TextInput
                    style={styles.rateLimitInput}
                    placeholder="60"
                    value={formData.rateLimits.rpm.toString()}
                    onChangeText={(value) =>
                      updateField('rateLimits', {
                        ...formData.rateLimits,
                        rpm: parseInt(value, 10) || 60,
                      })
                    }
                    keyboardType="number-pad"
                    editable={isMounted}
                  />
                </View>
                <View style={styles.rateLimitField}>
                  <Text style={styles.rateLimitLabel}>TPM</Text>
                  <TextInput
                    style={styles.rateLimitInput}
                    placeholder="1000"
                    value={formData.rateLimits.tpm.toString()}
                    onChangeText={(value) =>
                      updateField('rateLimits', {
                        ...formData.rateLimits,
                        tpm: parseInt(value, 10) || 1000,
                      })
                    }
                    keyboardType="number-pad"
                    editable={isMounted}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Agent</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal
        visible={showBreedPicker}
        title="Select Breed/Type"
        options={breedOptions}
        selectedValue={formData.breed}
        onSelect={(value) => updateField('breed', value)}
        onClose={() => setShowBreedPicker(false)}
      />

      <PickerModal
        visible={showGenderPicker}
        title="Select Gender"
        options={genderOptions}
        selectedValue={formData.gender}
        onSelect={(value) => updateField('gender', value)}
        onClose={() => setShowGenderPicker(false)}
      />

      <PickerModal
        visible={showProviderPicker}
        title="Select Model Provider"
        options={providerOptions}
        selectedValue={formData.modelProvider}
        onSelect={(value) => updateField('modelProvider', value)}
        onClose={() => setShowProviderPicker(false)}
      />
    </SafeAreaView>
  );
}
