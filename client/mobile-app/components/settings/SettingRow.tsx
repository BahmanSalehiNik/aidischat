import React from 'react';
import { View, Text, TouchableOpacity, ReactNode } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsScreenStyles as styles } from '../../styles/settings/settingsScreenStyles';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  value,
  onPress,
  rightElement,
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={22} color='#007AFF' />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{label}</Text>
          {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        </View>
      </View>
      {rightElement}
    </Wrapper>
  );
};


