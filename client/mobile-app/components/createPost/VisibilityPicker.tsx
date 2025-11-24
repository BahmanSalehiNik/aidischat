import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createPostScreenStyles as styles } from '../../styles/createPost/createPostScreenStyles';

export interface VisibilityOption {
  label: string;
  value: string;
  icon: string;
}

interface VisibilityPickerProps {
  value: string;
  options: VisibilityOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const VisibilityPicker: React.FC<VisibilityPickerProps> = ({
  value,
  options,
  disabled = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const toggleDropdown = () => {
    if (disabled) {
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View style={styles.visibilitySection}>
      <Text style={styles.sectionLabel}>Visibility</Text>
      <TouchableOpacity
        style={styles.visibilityButton}
        onPress={toggleDropdown}
        disabled={disabled}
      >
        <View style={styles.visibilityButtonContent}>
          {selectedOption && (
            <Ionicons name={selectedOption.icon as any} size={20} color="#007AFF" />
          )}
          <Text style={styles.visibilityButtonText}>
            {selectedOption?.label || 'Select'}
          </Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#8E8E93"
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.visibilityDropdown}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.visibilityOption,
                value === option.value && styles.visibilityOptionActive,
              ]}
              onPress={() => handleSelect(option.value)}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={value === option.value ? '#007AFF' : '#8E8E93'}
              />
              <Text
                style={[
                  styles.visibilityOptionText,
                  value === option.value && styles.visibilityOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {value === option.value && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color="#007AFF"
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};


