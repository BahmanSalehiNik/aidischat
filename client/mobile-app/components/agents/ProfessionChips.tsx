import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonProfessions } from '../../constants/agentConstants';
import { FormField } from './FormField';
import { professionChipsStyles as styles } from './styles/professionChipsStyles';

interface ProfessionChipsProps {
  selectedProfession: string;
  onSelect: (profession: string) => void;
  customProfession: string;
  onCustomChange: (value: string) => void;
}

export const ProfessionChips: React.FC<ProfessionChipsProps> = ({
  selectedProfession,
  onSelect,
  customProfession,
  onCustomChange,
}) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>Profession *</Text>
      <View style={styles.professionContainer}>
        {commonProfessions.map((prof) => (
          <TouchableOpacity
            key={prof}
            style={[
              styles.professionChip,
              selectedProfession === prof && styles.professionChipActive,
            ]}
            onPress={() => onSelect(prof)}
          >
            <Text
              style={[
                styles.professionChipText,
                selectedProfession === prof && styles.professionChipTextActive,
              ]}
            >
              {prof}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedProfession === 'other' && (
        <FormField
          label=""
          placeholder="Specify profession"
          value={customProfession}
          onChangeText={onCustomChange}
          maxLength={50}
          style={styles.marginTop}
        />
      )}
    </View>
  );
};

