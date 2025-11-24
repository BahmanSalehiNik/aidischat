import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsScreenStyles as styles } from '../../styles/settings/settingsScreenStyles';

export interface ThemeOption {
  label: string;
  value: string;
  icon: string;
}

interface ThemeOptionsProps {
  options: ThemeOption[];
  value: string;
  onChange: (value: string) => void;
}

export const ThemeOptions: React.FC<ThemeOptionsProps> = ({ options, value, onChange }) => (
  <View>
    {options.map((option) => {
      const isActive = value === option.value;
      return (
        <TouchableOpacity
          key={option.value}
          style={[styles.themeOption, isActive && styles.themeOptionActive]}
          onPress={() => onChange(option.value)}
        >
          <View style={styles.themeOptionLeft}>
            <Ionicons
              name={option.icon as any}
              size={20}
              color={isActive ? '#007AFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.themeOptionText,
                isActive && styles.themeOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </View>
          {isActive && <Ionicons name='checkmark' size={20} color='#007AFF' />}
        </TouchableOpacity>
      );
    })}
  </View>
);


