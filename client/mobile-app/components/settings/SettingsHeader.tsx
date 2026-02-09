import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsScreenStyles as styles } from '../../styles/settings/settingsScreenStyles';

interface SettingsHeaderProps {
  topInset: number;
  title?: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  topInset,
  title = 'Settings',
  onBack,
  rightElement,
}) => (
  <View style={[styles.header, { paddingTop: topInset }]}>
    <TouchableOpacity style={styles.backButton} onPress={onBack}>
      <Ionicons name='arrow-back' size={24} color='#000000' />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    {rightElement ? rightElement : <View style={styles.placeholder} />}
  </View>
);


