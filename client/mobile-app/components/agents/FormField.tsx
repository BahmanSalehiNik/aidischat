import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { formFieldStyles as styles } from './styles/formFieldStyles';

interface FormFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  style,
  ...textInputProps
}) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && '*'}
      </Text>
      <TextInput
        style={[styles.input, style]}
        {...textInputProps}
      />
    </View>
  );
};

